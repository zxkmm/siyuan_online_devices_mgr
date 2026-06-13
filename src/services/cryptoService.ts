import CryptoJS from "crypto-js";

/**
 * End-to-end encryption for GoEasy pub/sub messages.
 *
 * Scheme (bundle format `ENC1:<payload>`):
 *   payload = base64( hex(salt) + hex(iv) + base64(ciphertext) )
 *   - salt: 128-bit random, per-message
 *   - iv:   128-bit random, per-message
 *   - key:  PBKDF2(SHA-256, password, salt, KEY_ITERATIONS) -> 256-bit
 *   - cipher: AES-256-CBC, PKCS7 padding
 *
 * GoEasy (the SaaS provider) only ever sees the ciphertext bundle, never the
 * password or the derived key. The `ENC1` prefix versions the format so future
 * schemes can coexist.
 */

const FORMAT_PREFIX = "ENC1:";
const KEY_ITERATIONS = 50000;
const KEY_SIZE = 256 / 32; // 256-bit key, in 32-bit words (crypto-js convention)
const SALT_LEN_WORDS = 4; // 128-bit salt
const IV_LEN_WORDS = 4; // 128-bit IV

export function encrypt(plaintext: string, password: string): string {
  const salt = CryptoJS.lib.WordArray.random(SALT_LEN_WORDS * 4);
  const iv = CryptoJS.lib.WordArray.random(IV_LEN_WORDS * 4);

  const key = CryptoJS.PBKDF2(password, salt, {
    keySize: KEY_SIZE,
    iterations: KEY_ITERATIONS,
    hasher: CryptoJS.algo.SHA256,
  });

  const ciphertext = CryptoJS.AES.encrypt(plaintext, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  }).ciphertext;

  // Pack salt + iv + ciphertext into one transport-safe string.
  const payload =
    salt.toString(CryptoJS.enc.Hex) +
    iv.toString(CryptoJS.enc.Hex) +
    ciphertext.toString(CryptoJS.enc.Base64);

  return FORMAT_PREFIX + btoa(payload);
}

export function decrypt(bundle: string, password: string): string {
  if (!bundle || !bundle.startsWith(FORMAT_PREFIX)) {
    throw new Error("Not an encrypted message");
  }

  let payload: string;
  try {
    payload = atob(bundle.slice(FORMAT_PREFIX.length));
  } catch {
    throw new Error("Malformed encrypted message payload");
  }

  // salt (hex) + iv (hex) are fixed-width; ciphertext (base64) is the rest.
  const saltHexLen = SALT_LEN_WORDS * 8; // 4 words * 8 hex chars
  const ivHexLen = IV_LEN_WORDS * 8;
  if (payload.length < saltHexLen + ivHexLen) {
    throw new Error("Encrypted message too short");
  }

  const saltHex = payload.slice(0, saltHexLen);
  const ivHex = payload.slice(saltHexLen, saltHexLen + ivHexLen);
  const ciphertextB64 = payload.slice(saltHexLen + ivHexLen);

  const salt = CryptoJS.enc.Hex.parse(saltHex);
  const iv = CryptoJS.enc.Hex.parse(ivHex);
  const cipherParams = CryptoJS.lib.CipherParams.create({
    ciphertext: CryptoJS.enc.Base64.parse(ciphertextB64),
  });

  const key = CryptoJS.PBKDF2(password, salt, {
    keySize: KEY_SIZE,
    iterations: KEY_ITERATIONS,
    hasher: CryptoJS.algo.SHA256,
  });

  const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  const plaintext = decrypted.toString(CryptoJS.enc.Utf8);
  if (!plaintext) {
    // Wrong password / corrupted data -> empty Utf8 result or thrown exception
    throw new Error("Decryption failed (wrong password or corrupted data)");
  }
  return plaintext;
}
