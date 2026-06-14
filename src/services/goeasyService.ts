import GoEasy from "goeasy-lite";
import { encrypt, decrypt } from "./cryptoService";
import { showMessage } from "siyuan";

/**
 * GoEasy message transport.
 *
 * Single source of truth for sending and receiving. Chunking is a TRANSPORT
 * concern fully encapsulated here: callers just `sendMessage(plaintext)` and
 * the application layer's `handleMessage` callback only ever sees complete,
 * reassembled plaintext — it never deals with chunks, regardless of payload size.
 */

export class GoEasyService {
  /** Max length, in UTF-8 bytes, of a single encrypted message on the wire.
   *  GoEasy's real ceiling is ~2500; 2000 keeps a comfortable safety margin. */
  static readonly MAX_ENCRYPTED_BYTES = 2000;

  /** Per-chunk UTF-8 byte budget for the `data` field of a chunk envelope.
   *  Sized by arithmetic so the *encrypted* form of one chunk always fits:
   *    800 data + ~90 envelope JSON + 5 prefix  ≈  990 plaintext bytes
   *    AES-CBC + base64 + ENC1 overhead          ≈ 1713 encrypted chars
   *  That leaves ~300 chars of headroom under MAX_ENCRYPTED_BYTES, covering JSON
   *  escaping and multibyte characters. */
  static readonly CHUNK_DATA_BUDGET = 800;

  /** Drop a half-assembled message if the End marker never arrives — lost-chunk
   *  safety and a guard against leaking reassembly state. */
  static readonly CHUNK_ASSEMBLY_TIMEOUT_MS = 60000;

  private goeasy: any;
  private handleMessage: (message: any, deviceInfo: string) => void;
  private updateDeviceListFromPresence: (presenceEvent: any) => void;
  private encryptionPassword: string;
  private decryptFailNotice: string;

  /** In-progress chunk reassembly, keyed by chunk group id. */
  private pendingChunks: Map<string, PendingChunkGroup> = new Map();

  constructor(
    apiToken: string,
    encryptionPassword: string,
    handleMessageCallback: (message: any, deviceInfo: string) => void,
    updateDeviceListCallback: (presenceEvent: any) => void,
    decryptFailNotice: string
  ) {
    this.handleMessage = handleMessageCallback;
    this.updateDeviceListFromPresence = updateDeviceListCallback;
    this.encryptionPassword = encryptionPassword;
    this.decryptFailNotice = decryptFailNotice;

    this.goeasy = GoEasy.getInstance({
      host: "hangzhou.goeasy.io",
      appkey: apiToken,
      modules: ["pubsub"],
    });
  }

  connect(deviceInfo: string) {
    const deviceName = deviceInfo.split("^")[1];
    const deviceUuid = deviceInfo.split("^")[0];

    this.goeasy.connect({
      id: deviceInfo,
      data: { deviceUuid, deviceName },
      onSuccess: function () {
        console.log("GoEasy connect successfully.");
      },
      onFailed: function (error) {
        console.log(
          "Failed to connect GoEasy, code:" +
          error.code +
          ",error:" +
          error.content,
        );
      },
      onProgress: function (attempts) {
        console.log("GoEasy is connecting", attempts);
      },
    });

    this.setupSubscriptions(deviceInfo);
  }

  private setupSubscriptions(deviceInfo: string) {
    this.goeasy.pubsub.subscribe({
      channel: "online_devices",
      presence: { enable: true },
      onMessage: (message) => {
        console.log("Channel:" + message.channel + " content:" + message.content);
        let decryptedContent: string;
        try {
          decryptedContent = decrypt(message.content, this.encryptionPassword);
        } catch (error) {
          console.error("Failed to decrypt message:", error);
          showMessage(this.decryptFailNotice, 5000, "error");
          return;
        }
        this.routeDecrypted(decryptedContent, deviceInfo);
      },
      onSuccess: function () {
        console.log("Channel订阅成功。");
      },
      onFailed: function (error) {
        console.log(
          "Channel订阅失败, 错误编码：" +
          error.code +
          " 错误信息：" +
          error.content,
        );
      },
    });

    this.goeasy.pubsub.subscribePresence({
      channel: "online_devices",
      membersLimit: 20,
      onPresence: (presenceEvent) => {
        console.log("Presence events: ", JSON.stringify(presenceEvent));
        this.updateDeviceListFromPresence(presenceEvent);
      },
      onSuccess: function () {
        console.log("subscribe presence successfully.");
      },
      onFailed: function (error) {
        console.log(
          "Failed to subscribe presence, code:" +
          error.code +
          ",error:" +
          error.content,
        );
      },
    });
  }

  fetchOnlineDevices(callback: (response: any) => void) {
    this.goeasy.pubsub.hereNow({
      channel: "online_devices",
      limit: 20,
      onSuccess: function (response) {
        callback(response);
      },
      onFailed: function (error) {
        console.log(
          "Failed to obtain online clients, code:" +
          error.code +
          ",error:" +
          error.content,
        );
      },
    });
  }

  /**
   * Send a plaintext message to the channel. Transparently handles messages of
   * any size:
   *   - If the encrypted form fits MAX_ENCRYPTED_BYTES, publish it directly.
   *   - Otherwise split into chunk envelopes (`__chunk__`) plus a final
   *     `__chunk_end__` marker, each individually verified to fit, and the
   *     receiver reassembles them into the original plaintext before invoking
   *     `handleMessage`. No caller ever sees chunks.
   * Rejects on any publish failure (a partial chunked delivery would corrupt
   * the reassembled message, so we fail the whole thing rather than emit garbage).
   */
  sendMessage(plaintext: string): Promise<void> {
    const encrypted = encrypt(plaintext, this.encryptionPassword);
    if (encrypted.length <= GoEasyService.MAX_ENCRYPTED_BYTES) {
      return this.publishRaw(encrypted);
    }
    return this.sendChunked(plaintext);
  }

  /**
   * Split `plaintext` into chunk envelopes and publish each. Every piece is
   * verified to fit MAX_ENCRYPTED_BYTES before publish; if one ever overshoots
   * (shouldn't happen given the sized budget, but defensively) it is halved
   * on the spot — so an oversized message can NEVER reach GoEasy.
   *
   * Each piece carries a monotonic `seq` (not an array index), so subdivision
   * by the overshoot guard just emits more seq numbers without desyncing the
   * receiver. The authoritative `total` is sent only in the `__chunk_end__`
   * marker, computed from the final seq count.
   */
  private async sendChunked(plaintext: string): Promise<void> {
    const id = crypto.randomUUID();
    const encPw = this.encryptionPassword;
    const pieces = GoEasyService.splitByUtf8Bytes(
      plaintext,
      GoEasyService.CHUNK_DATA_BUDGET,
    );
    console.log(
      `[goeasy] chunking message: ${pieces.length} pieces, ${plaintext.length} chars plaintext`,
    );

    let seq = 0;
    const publishPiece = async (data: string): Promise<void> => {
      const envelope = JSON.stringify({ __chunk__: true, id, seq, data });
      const enc = encrypt(envelope, encPw);
      if (enc.length <= GoEasyService.MAX_ENCRYPTED_BYTES) {
        await this.publishRaw(enc);
        seq++;
        return;
      }
      // Defensive overshoot guard: halve the piece and send the halves, each
      // getting its own seq. Bounded by char count; a single char always fits.
      if (data.length <= 1) {
        throw new Error(
          `chunk seq=${seq} cannot fit under ${GoEasyService.MAX_ENCRYPTED_BYTES} bytes`,
        );
      }
      const halves = GoEasyService.splitByUtf8Bytes(
        data,
        Math.floor(data.length / 2),
      );
      for (const half of halves) {
        await publishPiece(half);
      }
    };

    for (const piece of pieces) {
      await publishPiece(piece);
    }

    const total = seq;
    const endEnvelope = JSON.stringify({ __chunk_end__: true, id, total });
    const encEnd = encrypt(endEnvelope, encPw);
    if (encEnd.length > GoEasyService.MAX_ENCRYPTED_BYTES) {
      // The end marker is tiny; if it ever overshoots something is very wrong.
      throw new Error("chunk end marker exceeded MAX_ENCRYPTED_BYTES");
    }
    await this.publishRaw(encEnd);
  }

  /**
   * Route a decrypted plaintext: feed chunk envelopes into the reassembly
   * buffer, or hand a complete (non-chunk) message straight to `handleMessage`.
   *
   * Normal application messages use the framing `<target>#<command>#<content>`
   * and are never bare JSON objects starting with `__chunk__`/`__chunk_end__`,
   * so there is no collision with the chunk protocol.
   */
  private routeDecrypted(decrypted: string, deviceInfo: string) {
    // Cheap pre-check: chunk envelopes always start with `{"__chunk`.
    if (
      decrypted.charCodeAt(0) === 123 && // '{'
      decrypted.indexOf("__chunk") !== -1
    ) {
      try {
        const parsed = JSON.parse(decrypted);
        if (parsed && typeof parsed === "object") {
          if (parsed.__chunk__ === true) {
            this.ingestChunk(parsed, deviceInfo);
            return;
          }
          if (parsed.__chunk_end__ === true) {
            this.ingestChunkEnd(parsed, deviceInfo);
            return;
          }
        }
      } catch {
        // Not valid JSON (or not a chunk) — fall through to normal dispatch.
      }
    }
    this.handleMessage({ content: decrypted }, deviceInfo);
  }

  /** Accumulate one `__chunk__` piece by id. The piece is keyed by its
   *  monotonic `seq` (not an array index), so it is robust against subdivision
   *  by the sender's overshoot guard and out-of-order delivery. `total` is not
   *  known until the `__chunk_end__` marker arrives. */
  private ingestChunk(payload: any, deviceInfo: string) {
    const id: string = payload.id;
    let pending = this.pendingChunks.get(id);
    if (!pending) {
      pending = {
        total: null,
        pieces: new Map<number, string>(),
        deviceInfo,
        timeoutId: setTimeout(() => {
          console.warn(
            `[goeasy] chunk group ${id} timed out before completion; discarding`,
          );
          this.pendingChunks.delete(id);
        }, GoEasyService.CHUNK_ASSEMBLY_TIMEOUT_MS),
      };
      this.pendingChunks.set(id, pending);
    }
    const seq: number = payload.seq;
    if (!pending.pieces.has(seq)) {
      pending.pieces.set(seq, payload.data);
    }
    this.tryFinalizeChunkGroup(id);
  }

  /** Mark a chunk group as fully sent; finalize if all pieces already arrived. */
  private ingestChunkEnd(payload: any, deviceInfo: string) {
    const id: string = payload.id;
    let pending = this.pendingChunks.get(id);
    if (!pending) {
      // End arrived with no buffered pieces — record it so a late-arriving piece
      // can still finalize, but arm the timeout so we don't leak.
      pending = {
        total: null,
        pieces: new Map<number, string>(),
        deviceInfo,
        timeoutId: setTimeout(() => {
          console.warn(
            `[goeasy] chunk group ${id} (end-first) timed out; discarding`,
          );
          this.pendingChunks.delete(id);
        }, GoEasyService.CHUNK_ASSEMBLY_TIMEOUT_MS),
      };
      this.pendingChunks.set(id, pending);
    }
    if (typeof payload.total === "number") {
      pending.total = payload.total;
    }
    this.tryFinalizeChunkGroup(id);
  }

  /** If all pieces of a group have arrived, join and dispatch the full message. */
  private tryFinalizeChunkGroup(id: string) {
    const pending = this.pendingChunks.get(id);
    if (!pending || pending.total === null) return;
    if (pending.pieces.size < pending.total) return;

    clearTimeout(pending.timeoutId);
    this.pendingChunks.delete(id);

    const sorted = Array.from(pending.pieces.keys()).sort((a, b) => a - b);
    const joined = sorted.map((i) => pending.pieces.get(i)).join("");
    this.handleMessage({ content: joined }, pending.deviceInfo);
  }

  /** Publish an already-encrypted message and resolve/reject on GoEasy callbacks. */
  private publishRaw(encrypted: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.goeasy.pubsub.publish({
        channel: "online_devices",
        message: encrypted,
        onSuccess: function () {
          console.log("消息发布成功。");
          resolve();
        },
        onFailed: function (error) {
          console.log(
            "消息发送失败，错误编码：" +
            error.code +
            " 错误信息：" +
            error.content,
          );
          reject(
            new Error(error?.code + ": " + (error?.content ?? "publish failed"))
          );
        },
      });
    });
  }

  /**
   * Split a string into pieces each <= maxBytes UTF-8 bytes, never splitting a
   * multibyte character mid-codepoint. Always advances at least one character
   * so the loop terminates even when a single character exceeds maxBytes.
   */
  private static splitByUtf8Bytes(str: string, maxBytes: number): string[] {
    const pieces: string[] = [];
    const enc = new TextEncoder();
    let i = 0;
    while (i < str.length) {
      let lo = i;
      let hi = str.length;
      // Binary search for the largest end index whose UTF-8 size fits.
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (enc.encode(str.substring(i, mid)).length <= maxBytes) {
          lo = mid;
        } else {
          hi = mid - 1;
        }
      }
      const end = Math.max(i + 1, lo); // always advance at least 1 char
      pieces.push(str.substring(i, end));
      i = end;
    }
    return pieces;
  }

  disconnect() {
    // Unsubscribe presence
    this.goeasy.pubsub.unsubscribePresence({
      channel: "online_devices",
      onSuccess: function () {
        console.log("unsubscribe presence successfully.");
      },
      onFailed: function (error) {
        console.log(
          "Failed to unsubscribe presence, code:" +
          error.code +
          ",error:" +
          error.content,
        );
      },
    });

    // Unsubscribe channel
    this.goeasy.pubsub.unsubscribe({
      channel: "online_devices",
      onSuccess: function () {
        console.log("订阅取消成功。");
      },
      onFailed: function (error) {
        console.log(
          "取消订阅失败，错误编码：" +
          error.code +
          " 错误信息：" +
          error.content,
        );
      },
    });

    // Disconnect
    this.goeasy.disconnect({
      onSuccess: function () {
        console.log("GoEasy disconnect successfully.");
      },
      onFailed: function (error) {
        console.log(
          "Failed to disconnect GoEasy, code:" +
          error.code +
          ",error:" +
          error.content,
        );
      },
    });
  }
}

/** Reassembly state for one in-progress chunked message. */
interface PendingChunkGroup {
  total: number | null; // set once the first chunk/End arrives
  pieces: Map<number, string>; // index -> data
  deviceInfo: string; // the local device info at receive time
  timeoutId: any;
}
