import {
  Plugin,
  showMessage,
  getFrontend,
  getBackend,
  Dialog,
  lockScreen,
} from "siyuan";
import "@/index.scss";

import { SettingUtils } from "./libs/setting-utils";
import { getDockHTML } from "./dock-template";
import { GoEasyService } from "./services/goeasyService";
import { DeviceService } from "./services/deviceService";
import { SNIPPET_RUNNER_VERSION } from "./services/deviceService";
import { NotificationService } from "./services/notificationService";
import { ClipboardService } from "./services/clipboardService";

const STORAGE_NAME = "menu-config";
const DOCK_TYPE = "dock_tab";
var already_noticed_this_boot = false;

/**
 * Bump this whenever the legal text (i18n disclaimerBody) changes meaningfully.
 * Stored per-install alongside the user's acceptance; a mismatch re-prompts the
 * disclaimer dialog before any feature (incl. the remote code-snippet runner)
 * can start. See `disclaimerAccepted()` / `onLayoutReady()`.
 *
 * v2 (2026-06): substantially expanded — added GPL/no-warranty, free-software &
 * donations, scoped liability limitation preserving the PRC statutory floor
 * (民法典 §506), author/SiYuan not-responsible clause, and the consent-state-
 * is-editable / technical-inference-of-prior-consent items.
 * v3 (2026-06): briefly added a "Rules of Interpretation" item; withdrawn.
 * v4 (2026-06): item 13 now covers software defects / supply-chain / open-source
 * acceptance (no-warranty of bugs/backdoors/malicious code in the plugin or its
 * dependencies; GPL open-source = download implies acceptance of code quality).
 */
const DISCLAIMER_VERSION = 4;

interface CodeSnippet {
  id: string;
  name: string;
  code: string;
}

interface PendingSnippetRun {
  resolve: (result: any) => void;
  reject: (error: any) => void;
  timeoutId: any;
}

export default class SiyuanOnlineDeviceManager extends Plugin {
  private goEasyService: GoEasyService;
  private deviceService: DeviceService;
  private notificationService: NotificationService;
  private clipboardService: ClipboardService;
  private pendingLocks: Map<string, any> = new Map();
  private pendingSnippetRuns: Map<string, PendingSnippetRun> = new Map();
  private deviceNicknames: Record<string, string> = {};

  // customTab: () => IModel;
  private isMobile: boolean;
  private settingUtils: SettingUtils;

  async onload() {
    this.addIcons(`<symbol id="iconDevices" viewBox="0 0 512 512">
      <path d="M472,232H424V120a24.028,24.028,0,0,0-24-24H40a24.028,24.028,0,0,0-24,24V366a24.028,24.028,0,0,0,24,24H212v50H152v32H304V440H244V390h92v58a24.027,24.027,0,0,0,24,24H472a24.027,24.027,0,0,0,24-24V256A24.027,24.027,0,0,0,472,232ZM336,256V358H48V128H392V232H360A24.027,24.027,0,0,0,336,256ZM464,440H368V264h96Z"></path>
      </symbol>
    `);

    this.data[STORAGE_NAME] = { readonlyText: "Readonly" };

    const frontEnd = getFrontend();
    this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";

    this.settingUtils = new SettingUtils({
      plugin: this,
      name: STORAGE_NAME,
    });

    this.initSettings();

    try {
      this.settingUtils.load();
    } catch (error) {
      console.error(
        "Error loading settings storage, probably empty config json:",
        error
      );
    }

    try {
      const data = await this.loadData("deviceNicknames.json");
      if (data) {
        this.deviceNicknames = data;
      }
    } catch (e) {
      console.error("Error loading device nicknames", e);
    }
  }

  private initSettings() {
    this.settingUtils.addItem({
      key: "begging",
      value: "",
      type: "hint",
      title: this.i18n.beggingTitle,
      description: this.i18n.beggingDesc,
    });

    this.settingUtils.addItem({
      key: "warning",
      value: "",
      type: "hint",
      title: this.i18n.warningTitle,
      description: this.i18n.warningDesc,
    });

    this.settingUtils.addItem({
      key: "viewDisclaimer",
      value: "",
      type: "button",
      title: this.i18n.disclaimerTitle,
      description: this.i18n.disclaimerNotAcceptedDesc,
      button: {
        label: this.i18n.viewDisclaimerLabel,
        callback: () => {
          this.showDisclaimerDialog({ mustAcceptToContinue: false });
        },
      },
    });

    // Consent state for the disclaimer gate (see onLayoutReady/disclaimerAccepted).
    // Default 0 so the dialog always shows on a fresh install.
    this.settingUtils.addItem({
      key: "disclaimerAcceptedVersion",
      value: 0,
      type: "custom",
      title: "",
      description: "",
      createElement: () => {
        const el = document.createElement("div");
        el.style.display = "none";
        return el;
      },
      getEleVal: () => this.settingUtils.get("disclaimerAcceptedVersion"),
      setEleVal: (_ele: HTMLElement, val: any) => {
        void val;
      },
    });

    this.settingUtils.addItem({
      key: "mainSwitch",
      value: false,
      type: "checkbox",
      title: this.i18n.mainSwitch,
      description: this.i18n.mainSwitchDesc,
      action: {
        callback: () => {
          let value = !this.settingUtils.get("mainSwitch");
          this.settingUtils.set("mainSwitch", value);
        },
      },
    });

    this.settingUtils.addItem({
      key: "goeasySwitch",
      value: false,
      type: "checkbox",
      title: this.i18n.goeasySwitch,
      description: this.i18n.goeasySwitchDesc,
      action: {
        callback: () => {
          let value = !this.settingUtils.get("goeasySwitch");
          this.settingUtils.set("goeasySwitch", value);
        },
      },
    });

    this.settingUtils.addItem({
      key: "goeasyToken",
      value: "",
      type: "textinput",
      title: this.i18n.goeasyToken,
      description: this.i18n.goeasyTokenDesc,
      action: {
        // Called when focus is lost and content changes
        callback: () => {
          let value = this.settingUtils.takeAndSave("goeasyToken");
          //   console.log(value);
        },
      },
    });

    this.settingUtils.addItem({
      key: "encryptionPassword",
      value: "",
      type: "textinput",
      title: this.i18n.encryptionPassword,
      description: this.i18n.encryptionPasswordDesc,
      action: {
        // Called when focus is lost and content changes
        callback: () => {
          this.settingUtils.takeAndSave("encryptionPassword");
        },
      },
    });

    this.settingUtils.addItem({
      key: "barkMsgSwitch",
      value: false,
      type: "checkbox",
      title: this.i18n.barkMsgSwitch,
      description: this.i18n.barkMsgSwitchDesc,
      action: {
        callback: () => {
          let value = !this.settingUtils.get("barkMsgSwitch");
          this.settingUtils.set("barkMsgSwitch", value);
        },
      },
    });

    this.settingUtils.addItem({
      key: "barkApiBaseLink",
      value: "",
      type: "textinput",
      title: this.i18n.barkApiBaseLink,
      description: this.i18n.barkApiBaseLinkDesc,
      action: {
        // Called when focus is lost and content changes
        callback: () => {
          let value = this.settingUtils.takeAndSave("barkApiBaseLink");
          console.log(value);
        },
      },
    });

    this.settingUtils.addItem({
      key: "displayNoticeWhenBarkNotiSent",
      value: true,
      type: "checkbox",
      title: this.i18n.displayNoticeWhenBarkNotiSent,
      description: this.i18n.displayNoticeWhenBarkNotiSentDesc,
      action: {
        callback: () => {
          let value = !this.settingUtils.get("displayNoticeWhenBarkNotiSent");
          this.settingUtils.set("displayNoticeWhenBarkNotiSent", value);
          //   console.log(value);
        },
      },
    });

    this.settingUtils.addItem({
      key: "onlyEnableListedDevices",
      value: false,
      type: "checkbox",
      title: this.i18n.onlyEnableListedDevices,
      description: this.i18n.onlyEnableListedDevicesDesc,
    });
    this.settingUtils.addItem({
      key: "enableDeviceList",
      value: "",
      type: "textarea",
      title: this.i18n.enableDeviceList,
      description: this.i18n.enableDeviceListDesc,
    });
    this.settingUtils.addItem({
      key: "addCurrentDeviceIntoList",
      value: "",
      type: "button",
      title: this.i18n.addCurrentDeviceIntoList,
      description: this.i18n.addCurrentDeviceIntoListDesc,
      button: {
        label: this.i18n.addCurrentDeviceIntoListLabel,
        callback: () => {
          this.appendCurrentDeviceIntoList();
        },
      },
    });
    this.settingUtils.addItem({
      key: "removeCurrentDeviceFromList",
      value: "",
      type: "button",
      title: this.i18n.removeCurrentDeviceFromList,
      description: this.i18n.removeCurrentDeviceFromListDesc,
      button: {
        label: this.i18n.removeCurrentDeviceFromListLabel,
        callback: () => {
          this.removeCurrentDeviceFromList();
        },
      },
    });
    this.settingUtils.addItem({
      key: "passwordHistory",
      value: "",
      type: "textarea",
      title: this.i18n.textPasswordHistory,
      description: this.i18n.textPasswordHistoryDesc,
    });
    this.settingUtils.addItem({
      key: "viewPasswordHistory",
      value: "",
      type: "button",
      title: this.i18n.textViewPasswordHistory,
      description: "",
      button: {
        label: this.i18n.textViewPasswordHistory,
        callback: () => {
          this.showPasswordHistoryDialog();
        },
      },
    });
    this.settingUtils.addItem({
      key: "codeSnippets",
      value: [],
      type: "custom",
      title: this.i18n.textManageSnippets,
      description: this.i18n.textManageSnippetsDesc,
      createElement: (_currentVal: any) => {
        const hint = document.createElement("div");
        hint.className = "b3-label fn__flex-center";
        hint.innerHTML = this.i18n.textManageSnippetsSettingHint;
        return hint;
      },
      getEleVal: () => this.settingUtils.get("codeSnippets"),
      setEleVal: (_ele: HTMLElement, val: any) => {
        /* value is managed via the dock UI; nothing to render here */
        void val;
      },
    });
    this.settingUtils.addItem({
      key: "codeSnippetsSeeded",
      value: false,
      type: "custom",
      title: "",
      description: "",
      createElement: () => {
        const el = document.createElement("div");
        el.style.display = "none";
        return el;
      },
      getEleVal: () => this.settingUtils.get("codeSnippetsSeeded"),
      setEleVal: (_ele: HTMLElement, val: any) => {
        void val;
      },
    });
    this.settingUtils.addItem({
      key: "Hint",
      value: "",
      type: "hint",
      title: this.i18n.hintTitle,
      description: this.i18n.hintDesc,
    });
  }

  handleMessage = async (message: any, deviceInfo: string) => {
    // Format: <targetDevice>#<command>#<content>
    // `content` may itself contain '#' (e.g. JSON payloads or arbitrary code),
    // so split only into the first three parts and keep the rest of `content` intact.
    const firstHash = message.content.indexOf("#");
    const secondHash = message.content.indexOf("#", firstHash + 1);
    const receivedDevice =
      firstHash >= 0 ? message.content.substring(0, firstHash) : "";
    const receivedCommand =
      firstHash >= 0 && secondHash > firstHash
        ? message.content.substring(firstHash + 1, secondHash)
        : firstHash >= 0
        ? message.content.substring(firstHash + 1)
        : "";
    const receivedContent =
      secondHash >= 0 ? message.content.substring(secondHash + 1) : "";

    switch (receivedCommand) {
      case "lockScreen":
        if (receivedDevice === deviceInfo) {
          await this.deviceService.lockCurrentDevice();
        }
        break;
      case "exitSiyuan":
        if (receivedDevice === deviceInfo) {
          this.deviceService.exitCurrentDevice();
        }
        break;
      case "humanMessage":
        if (receivedDevice === "ALL" || receivedDevice === deviceInfo) {
          showMessage(receivedContent);
        }
        break;
      case "clipboard":
        if (receivedDevice === "ALL" || receivedDevice === deviceInfo) {
          this.clipboardService.copyToClipboard(receivedContent);
        }
        break;
      case "triggerSync":
        if (receivedDevice === deviceInfo) {
          await this.deviceService.syncCurrentDevice();
        }
        break;
      case "setAutoPassword":
        if (receivedDevice === deviceInfo) {
          await this.deviceService.setCurrentDeviceAutoPassword(receivedContent);
        }
        break;
      case "runSnippet":
        if (receivedDevice === deviceInfo) {
          try {
            const payload = JSON.parse(receivedContent);
            console.log(
              `[snippet-run] received request id=${payload.id} requesterRunnerVersion=${payload.localRunnerVersion} localRunnerVersion=${SNIPPET_RUNNER_VERSION}`
            );
            let ok = true;
            let result: any = null;
            let error: string = null;
            try {
              result = await this.deviceService.runCodeOnCurrentDevice(
                payload.code
              );
            } catch (e) {
              ok = false;
              error = e?.message ?? String(e);
              console.error(`[snippet-run] execution failed id=${payload.id}:`, e);
            }
            console.log(
              `[snippet-run] sending response id=${payload.id} ok=${ok} runnerVersion=${SNIPPET_RUNNER_VERSION}`
            );
            // Deliver the result. sendMessage auto-chunks transparently if the
            // encrypted form is too large for a single GoEasy message, so the full
            // result is always delivered intact — no data loss, no truncation.
            const resultJson = JSON.stringify({
              id: payload.id,
              ok,
              result: ok ? result : null,
              error,
              runnerVersion: SNIPPET_RUNNER_VERSION,
            });
            try {
              await this.goEasyService.sendMessage(
                payload.from + "#snippetResult#" + resultJson
              );
            } catch (e) {
              console.error(
                `[snippet-run] could not deliver response id=${payload.id}, sending fallback error`,
                e
              );
              // Fallback: a trimmed error always fits a single message.
              const fallbackJson = JSON.stringify({
                id: payload.id,
                ok: false,
                result: null,
                error:
                  "Could not deliver the result via GoEasy (publish failed). The remote device may be offline or the snippet took too long.",
                runnerVersion: SNIPPET_RUNNER_VERSION,
              });
              try {
                await this.goEasyService.sendMessage(
                  payload.from + "#snippetResult#" + fallbackJson
                );
              } catch (e2) {
                console.error(
                  `[snippet-run] fallback error delivery also failed id=${payload.id}`,
                  e2
                );
              }
            }
          } catch (e) {
            console.error("Failed to handle runSnippet message:", e);
          }
        }
        break;
      case "snippetResult":
        try {
          const payload = JSON.parse(receivedContent);
          const pending = this.pendingSnippetRuns.get(payload.id);
          if (pending) {
            clearTimeout(pending.timeoutId);
            this.pendingSnippetRuns.delete(payload.id);
            if (payload.ok) {
              pending.resolve({
                result: payload.result,
                runnerVersion: payload.runnerVersion,
              });
            } else {
              pending.reject(
                Object.assign(new Error(payload.error), {
                  runnerVersion: payload.runnerVersion,
                })
              );
            }
          }
        } catch (e) {
          console.error("Failed to handle snippetResult message:", e);
        }
        break;
      default:
        console.log("Unknown command:", receivedCommand);
    }
  };

  updateDeviceListFromPresence = (presenceEvent: any) => {
    this.updateOnlineDeviceList();
  };

  initializeServices() {
    // clipboard service
    this.clipboardService = new ClipboardService();

    // notification service
    this.notificationService = new NotificationService(
      this.settingUtils.get("barkApiBaseLink"),
      this.settingUtils.get("displayNoticeWhenBarkNotiSent")
    );

    const token = this.settingUtils.get("goeasyToken");
    const encryptionPassword = this.settingUtils.get("encryptionPassword");
    if (this.settingUtils.get("goeasySwitch")) {
      if (token) {
        if (encryptionPassword) {
          // GoEasy service with message handler (messages are end-to-end encrypted)
          this.goEasyService = new GoEasyService(
            token,
            encryptionPassword,
            this.handleMessage,
            this.updateDeviceListFromPresence,
            this.i18n.decryptFail
          );
        } else {
          showMessage(
            this.i18n.name + ": " + this.i18n.encryptionPasswordMissing,
            5000,
            "error"
          );
        }
      } else {
        showMessage(
          this.i18n.name + ": " + this.i18n.goeasyTokenMissing,
          5000,
          "error"
        );
      }
    }

    if (
      this.settingUtils.get("barkMsgSwitch") &&
      !this.settingUtils.get("barkApiBaseLink")
    ) {
      showMessage(this.i18n.name + ": " + this.i18n.barkUrlMissing, 5000, "error");
    }

    // device service
    this.deviceService = new DeviceService(
      this.goEasyService,
      () => this.onLockScreen() // this got to be callback bc ONLY this base plugin class can call lockScreen(this.app) somehow.
    );

    // connect to GoEasy
    if (this.goEasyService) {
      const deviceInfo = this.deviceService.getCurrentDeviceInfo();
      const deviceData = this.deviceService.getCurrentDeviceData();
      this.goEasyService.connect(deviceInfo, deviceData);
    }
  }

  onLayoutReady() {
    // Disclaimer consent gate. Block EVERYTHING below (GoEasy connect, dock,
    // and crucially the remote code-snippet runner) until the user has accepted
    // the current version of the disclaimer. Re-prompts whenever the legal text
    // version changes (DISCLAIMER_VERSION mismatch), per the user's choice.
    if (!this.disclaimerAccepted()) {
      this.showDisclaimerDialog({ mustAcceptToContinue: true }).then(
        (accepted) => {
          if (accepted) {
            this.settingUtils.setAndSave(
              "disclaimerAcceptedVersion",
              DISCLAIMER_VERSION
            );
            this.maybeInitMainFeature();
          } else {
            showMessage(
              this.i18n.disclaimerNotAcceptedDesc,
              7000,
              "info"
            );
          }
        }
      );
      return;
    }
    this.maybeInitMainFeature();
  }

  /**
   * True iff the user has accepted the *current* version of the disclaimer.
   * A version mismatch (e.g. after a legal-text update) returns false and
   * triggers a fresh consent prompt in onLayoutReady().
   */
  private disclaimerAccepted(): boolean {
    return (
      this.settingUtils.get("disclaimerAcceptedVersion") === DISCLAIMER_VERSION
    );
  }

  /**
   * The main-feature init path, gated behind disclaimer consent.
   * Extracted verbatim from the original onLayoutReady() body so behaviour for
   * already-consenting users is unchanged.
   */
  private maybeInitMainFeature() {
    if (this.settingUtils.get("mainSwitch")) {
      this.initializeServices();

      if (this.goEasyService) {
        this.goEasyService.fetchOnlineDevices(() => {});

        this.addDock({
          config: {
            position: "LeftBottom",
            size: { width: 200, height: 0 },
            icon: "iconDevices",
            title: this.i18n.name,
            hotkey: "⌥⌘M",
          },
          data: {
            text: this.i18n.name,
          },
          type: DOCK_TYPE,
          resize() {
            console.log(DOCK_TYPE + " resize");
          },
          update() {
            console.log(DOCK_TYPE + " update");
          },
          init: (dock) => {
            dock.element.innerHTML = getDockHTML(this.isMobile, this);
            this.updateOnlineDeviceList();
            this.addRefreshButtonListener();
            this.addBroadcastButtonListener();
            this.addBroadcastClipboardButtonListener();
            this.addManageSnippetsButtonListener();
            this.addViewDisclaimerButtonListener();
          },
          destroy() {
            console.log("destroy dock:", DOCK_TYPE);
          },
        });
      }

      this.handleLayoutReadyAsync();
    }
  }

  /**
   * Reusable disclaimer dialog.
   * - mustAcceptToContinue=true: gate mode (first run / version mismatch).
   *   Resolves true on Accept (caller persists the version + inits the feature),
   *   false on Decline/close (feature stays disabled).
   * - mustAcceptToContinue=false: re-view mode (dock/settings "View" button).
   *   Read-only; re-accepting is a harmless no-op since the stored version is
   *   already current.
   */
  showDisclaimerDialog = (opts: {
    mustAcceptToContinue: boolean;
  }): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (accepted: boolean) => {
        if (settled) return;
        settled = true;
        dialog.destroy();
        resolve(accepted);
      };

      const dialog = new Dialog({
        title: this.i18n.disclaimerTitle,
        content: `<div class="b3-dialog__content" style="max-height: 60vh; overflow-y: auto;">${this.i18n.disclaimerBody}</div>
        <div class="b3-dialog__action" style="flex-direction: column; align-items: stretch; gap: 10px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 14px;">
            <input type="checkbox" id="disclaimerAcceptCheckbox" style="width: 18px; height: 18px;" />
            <span>${this.i18n.disclaimerAcceptLabel}</span>
          </label>
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button class="b3-button b3-button--cancel">${this.i18n.disclaimerDeclineBtn}</button>
            <button class="b3-button b3-button--text" id="disclaimerAcceptBtn" disabled>${this.i18n.disclaimerAcceptBtn}</button>
          </div>
        </div>`,
        width: this.isMobile ? "95vw" : "640px",
        // Disallow closing via the close icon in gate mode so the user must
        // explicitly choose Accept or Decline. In re-view mode closing is fine.
        hideCloseIcon: opts.mustAcceptToContinue,
      });

      const checkbox: HTMLInputElement =
        dialog.element.querySelector("#disclaimerAcceptCheckbox");
      const acceptBtn: HTMLButtonElement =
        dialog.element.querySelector("#disclaimerAcceptBtn");
      const cancelBtn: HTMLButtonElement = dialog.element.querySelector(
        ".b3-button--cancel"
      );

      checkbox?.addEventListener("change", () => {
        if (acceptBtn) acceptBtn.disabled = !checkbox.checked;
      });

      acceptBtn?.addEventListener("click", () => {
        if (checkbox?.checked) finish(true);
      });
      cancelBtn?.addEventListener("click", () => finish(false));
    });
  };

  addViewDisclaimerButtonListener() {
    const btn = document.getElementById("viewDisclaimer");
    if (btn) {
      btn.addEventListener("click", () => {
        // Re-view mode: read-only, no gate effect.
        this.showDisclaimerDialog({ mustAcceptToContinue: false });
      });
    }
  }

  private async handleLayoutReadyAsync() {
    try {
      if (
        (await this.currentDeviceInList()) ||
        !this.settingUtils.get("onlyEnableListedDevices")
      ) {
        if (
          this.settingUtils.get("mainSwitch") &&
          this.settingUtils.get("barkMsgSwitch") &&
          this.settingUtils.get("barkApiBaseLink") !== ""
        ) {
          already_noticed_this_boot =
            await this.notificationService.sendBarkDeviceOnlineNotification(
              this.deviceService.getCurrentDeviceInfo(),
              this.i18n.barkOnlineNoticeTitle,
              this.i18n.barkOnlineNoticeContentHeader,
              this.i18n.onlineLocalmachineNoticeText,
              already_noticed_this_boot
            );
        }
      }
    } catch (error) {
      console.error("Error in layout ready async handler:", error);
    }
  }

  updateOnlineDeviceList() {
    this.goEasyService.fetchOnlineDevices((response) => {
      let deviceListHtml = "";
      const onlineDeviceIds = response.content.members.map(m => m.id);

      // Check for success of pending locks
      for (const [deviceId, timeoutId] of this.pendingLocks.entries()) {
        if (!onlineDeviceIds.includes(deviceId)) {
          // Success! Device is gone from online list
          clearTimeout(timeoutId);
          this.pendingLocks.delete(deviceId);
          showMessage(this.i18n.textLockSuccess);
        }
      }

      response.content.members.forEach((member) => {
        const isLocking = this.pendingLocks.has(member.id);
        const lockIcon = isLocking ? '<svg class="svg loading-icon"><use xlink:href="#iconRefresh"></use></svg>' : '<svg class="svg"><use xlink:href="#iconLock"></use></svg>';
        const lockClass = isLocking ? "device-action lock-siyuan locking" : "device-action lock-siyuan";
        
        let dataFieldsHtml = "";
        let deviceNameDisplay = "Unknown Device";
        if (member.data && typeof member.data === "object") {
          deviceNameDisplay = member.data.deviceName || deviceNameDisplay;
          for (const [key, value] of Object.entries(member.data)) {
            dataFieldsHtml += `<div style="width: 100%; word-break: break-all;">${key}: ${value}</div>`;
          }
        }
        
        const nickname = member.data && member.data.deviceUuid ? this.deviceNicknames[member.data.deviceUuid] : undefined;
        if (nickname) {
          deviceNameDisplay = `${nickname} (${deviceNameDisplay})`;
        }
        
        const detailsHtml = `
          <details style="width: 100%; margin-top: 4px;">
            <summary style="cursor: pointer; opacity: 0.7; font-size: 0.9em;">${this.i18n.textMoreInfo}</summary>
            <div style="margin-top: 4px; padding-left: 8px; font-size: 0.9em; opacity: 0.8; border-left: 2px solid var(--b3-theme-background-light);">
              <div style="width: 100%; word-break: break-all; margin-bottom: 2px;">ID: ${member.id}</div>
              ${dataFieldsHtml}
            </div>
          </details>
        `;
        
        deviceListHtml +=
          member.id == this.deviceService.getCurrentDeviceInfo() //local machine or not
            ? ` 
          <div class="device-item">
            <div class="device-info">
              <div style="font-weight: bold; word-break: break-all; display: flex; align-items: center; gap: 8px;">
                <span>${deviceNameDisplay}</span>
                <button class="device-action set-nickname b3-button b3-button--text b3-tooltips b3-tooltips__nw" aria-label="${this.i18n.textSetNickname}" data-device-id="${member.id}" data-device-uuid="${member.data?.deviceUuid || ''}" style="padding: 0; width: 20px; height: 20px; flex-shrink: 0; min-width: auto; background: transparent;"><svg class="svg"><use xlink:href="#iconEdit"></use></svg></button>
              </div>
              ${detailsHtml}
            </div>
            <div class="device-actions">
            <span class="device-action device-itsme b3-button b3-button--outline fn__flex-center" style="opacity: 0.8; pointer-events: none;"><svg class="svg"><use xlink:href="#iconTerminal"></use></svg> ${this.i18n.textLocalMachine}</span>
            <button class="${lockClass} b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}" style="display: none;">${lockIcon} ${this.i18n.textLock}</button>
            <button class="device-action exit-siyuan b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}" style="display: none;"><svg class="svg"><use xlink:href="#iconQuit"></use></svg> ${this.i18n.textExit}</button>
            <button class="device-action send-human-msg b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}" style="display: none;"><svg class="svg"><use xlink:href="#iconEmail"></use></svg> ${this.i18n.textSendMessage}</button>
            <button class="device-action send-clipboard b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}" style="display: none;"><svg class="svg"><use xlink:href="#iconPaste"></use></svg> ${this.i18n.textSendToClipboard}</button>
            <button class="device-action trigger-sync b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}" style="display: none;"><svg class="svg"><use xlink:href="#iconCloud"></use></svg> ${this.i18n.textTriggerSync}</button>
            <button class="device-action set-auto-password b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}" style="display: none;"><svg class="svg"><use xlink:href="#iconLock"></use></svg> ${this.i18n.textSetAutoPassword}</button>
            </div>
          </div>
        `
            : `
          <div class="device-item">
            <div class="device-info">
              <div style="font-weight: bold; word-break: break-all; display: flex; align-items: center; gap: 8px;">
                <span>${deviceNameDisplay}</span>
                <button class="device-action set-nickname b3-button b3-button--text b3-tooltips b3-tooltips__nw" aria-label="${this.i18n.textSetNickname}" data-device-id="${member.id}" data-device-uuid="${member.data?.deviceUuid || ''}" style="padding: 0; width: 20px; height: 20px; flex-shrink: 0; min-width: auto; background: transparent;"><svg class="svg"><use xlink:href="#iconEdit"></use></svg></button>
              </div>
              ${detailsHtml}
            </div>
            <div class="device-actions">
              <button class="${lockClass} b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}">${lockIcon} ${this.i18n.textLock}</button>
              <button class="device-action exit-siyuan b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}"><svg class="svg"><use xlink:href="#iconQuit"></use></svg> ${this.i18n.textExit}</button>
              <button class="device-action send-human-msg b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}"><svg class="svg"><use xlink:href="#iconEmail"></use></svg> ${this.i18n.textSendMessage}</button>
              <button class="device-action send-clipboard b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}"><svg class="svg"><use xlink:href="#iconPaste"></use></svg> ${this.i18n.textSendToClipboard}</button>
              <button class="device-action trigger-sync b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}"><svg class="svg"><use xlink:href="#iconCloud"></use></svg> ${this.i18n.textTriggerSync}</button>
              <button class="device-action set-auto-password b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}"><svg class="svg"><use xlink:href="#iconLock"></use></svg> ${this.i18n.textSetAutoPassword}</button>
              <button class="device-action run-snippet b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}"><svg class="svg"><use xlink:href="#iconTerminal"></use></svg> ${this.i18n.textRunSnippet}</button>


            </div>
          </div>
        `;
      });
      const deviceListElement = document.getElementById("onlineDeviceList");
      if (deviceListElement) {
        deviceListElement.innerHTML = deviceListHtml;
        this.addDeviceActionListeners();
      }
    });
  }

  addRefreshButtonListener() {
    const refreshButton = document.getElementById("refreshDeviceList");
    if (refreshButton) {
      refreshButton.addEventListener("click", () => {
        this.updateOnlineDeviceList();
      });
    }
  }

  addBroadcastButtonListener() {
    const sendBroadcastButton = document.getElementById("sendBroadcast");
    if (sendBroadcastButton) {
      sendBroadcastButton.addEventListener("click", () => {
        this.inputDialog({
          title: this.i18n.textSendBroadcast,
          placeholder: this.i18n.textSendBroadcastPlaceholder,
          width: this.isMobile ? "95vw" : "70vw",
          height: this.isMobile ? "95vw" : "30vw",
          confirm: (text: string) => {
            this.goEasyService.sendMessage("ALL#humanMessage#" + text);
            console.log("send human msg:", text);
            //TODO: more thigns here maybe
          },
        });
      });
    }
  }

  addBroadcastClipboardButtonListener() {
    const sendBroadcastClipboardButton = document.getElementById(
      "sendBroadcastClipboard"
    );
    if (sendBroadcastClipboardButton) {
      sendBroadcastClipboardButton.addEventListener("click", () => {
        this.inputDialog({
          title: this.i18n.textSendBroadcastClipboard,
          placeholder: this.i18n.textSendBroadcastClipboardPlaceholder,
          width: this.isMobile ? "95vw" : "70vw",
          height: this.isMobile ? "95vw" : "30vw",
          confirm: (text: string) => {
            this.goEasyService.sendMessage("ALL#clipboard#" + text);
            console.log("send clipboard:", text);
            //TODO: more thigns here maybe
          },
        });
      });
    }
  }

  addManageSnippetsButtonListener() {
    const manageButton = document.getElementById("manageSnippets");
    if (manageButton) {
      manageButton.addEventListener("click", async () => {
        await this.seedOfficialExamplesIfFirstRun();
        this.showManageSnippetsDialog();
      });
    }
  }

  addDeviceActionListeners() {
    const actionButtons = document.querySelectorAll(".device-action");
    actionButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        // Resolve the actual button even if the click landed on the inner <svg>/<use>
        const target = (e.target as HTMLElement).closest(
          ".device-action"
        ) as HTMLElement;
        if (!target) return;
        const deviceId = target.getAttribute("data-device-id");
        const deviceUuid = target.getAttribute("data-device-uuid");
        const action = target.classList.contains("lock-siyuan")
          ? "lock-siyuan"
          : target.classList.contains("exit-siyuan")
          ? "exit-siyuan"
          : target.classList.contains("send-human-msg")
          ? "send-human-msg"
          : target.classList.contains("send-clipboard")
          ? "send-clipboard"
          : target.classList.contains("trigger-sync")
          ? "trigger-sync"
          : target.classList.contains("set-auto-password")
          ? "set-auto-password"
          : target.classList.contains("set-nickname")
          ? "set-nickname"
          : target.classList.contains("run-snippet")
          ? "run-snippet"
          : null;
        if (deviceId && action) {
          this.performDeviceAction(deviceId, action, deviceUuid);
        }
      });
    });
  }

  performDeviceAction(deviceId: string, action: string, deviceUuid?: string) {
    switch (action) {
      case "lock-siyuan":
        if (this.pendingLocks.has(deviceId)) return;

        const timeoutId = setTimeout(() => {
          if (this.pendingLocks.has(deviceId)) {
            this.pendingLocks.delete(deviceId);
            showMessage(this.i18n.textLockFail, 10000, "error");
            this.updateOnlineDeviceList();
          }
        }, 3000);

        this.pendingLocks.set(deviceId, timeoutId);
        this.deviceService.lockDevice(deviceId);
        this.updateOnlineDeviceList();
        break;
      case "exit-siyuan":
        this.deviceService.exitDevice(deviceId);
        console.log("Exit device:", deviceId);
        break;
      case "send-human-msg":
        this.inputDialog({
          title: this.i18n.textSendMessage,
          placeholder: this.i18n.textSendMessagePlaceholder,
          width: this.isMobile ? "95vw" : "70vw",
          height: this.isMobile ? "95vw" : "30vw",
          confirm: (text: string) => {
            this.goEasyService.sendMessage(deviceId + "#humanMessage#" + text);
            //TODO: more thigns here maybe
          },
        });
        console.log("send human msg:", deviceId);
        break;
      case "send-clipboard":
        this.inputDialog({
          title: this.i18n.textSendToClipboard,
          placeholder: this.i18n.textSendToClipboardPlaceholder,
          width: this.isMobile ? "95vw" : "70vw",
          height: this.isMobile ? "95vw" : "30vw",
          confirm: (text: string) => {
            this.goEasyService.sendMessage(deviceId + "#clipboard#" + text);
            //TODO: more thigns here maybe
          },
        });
        break;
      case "trigger-sync":
        this.deviceService.triggerSync(deviceId);
        break;
      case "set-auto-password":
        this.passwordDoubleCheckDialog({
          confirm: (password: string) => {
            this.savePasswordToHistory(deviceId, password);
            this.deviceService.setAutoPassword(deviceId, password);
          },
        });
        break;
      case "set-nickname":
        if (!deviceUuid) {
          console.error("No deviceUuid found for setting nickname.");
          return;
        }
        this.inputDialog({
          title: this.i18n.textSetNickname,
          placeholder: this.i18n.textNicknamePlaceholder,
          width: this.isMobile ? "95vw" : "50vw",
          height: this.isMobile ? "95vw" : "30vw",
          confirm: (text: string) => {
            if (text.trim() === "") {
              delete this.deviceNicknames[deviceUuid];
            } else {
              this.deviceNicknames[deviceUuid] = text.trim();
            }
            this.saveData("deviceNicknames.json", this.deviceNicknames);
            this.updateOnlineDeviceList();
          },
        });
        break;
      case "run-snippet":
        this.showSnippetPickerDialog(deviceId, (did, snippet) =>
          this.runSnippetOnDevice(did, snippet)
        );
        break;
    }
  }

  savePasswordToHistory(deviceId: string, password: string) {
    const history = this.settingUtils.get("passwordHistory") || "";
    const date = new Date().toLocaleString();
    const newEntry = `[${date}] ${deviceId}: ${password}`;
    const newHistory = history ? history + "\n" + newEntry : newEntry;
    this.settingUtils.assignValue("passwordHistory", newHistory);
    this.settingUtils.save();
  }

  getSnippets(): CodeSnippet[] {
    const value = this.settingUtils.get("codeSnippets");
    if (!Array.isArray(value)) return [];
    return value as CodeSnippet[];
  }

  async saveSnippets(list: CodeSnippet[]) {
    // setAndSave persists without reloading (assignValue would reload the page)
    await this.settingUtils.setAndSave("codeSnippets", list);
  }

  getOfficialExampleSnippets(): CodeSnippet[] {
    // Official hardcoded examples. Each runs on the remote device via `request(apiPath, data)`.
    return [
      {
        id: "example-kernel-version",
        name: this.i18n.exampleNameKernelVersion,
        code: `// Returns the remote SiYuan kernel version.
return await request("/api/system/version", {});`,
      },
      {
        id: "example-current-time",
        name: this.i18n.exampleNameCurrentTime,
        code: `// Returns the remote device's current server time.
return await request("/api/system/currentTime", {});`,
      },
      {
        id: "example-notebooks",
        name: this.i18n.exampleNameNotebooks,
        code: `// Lists all notebooks on the remote device.
return await request("/api/notebook/lsNotebooks", {});`,
      },
      {
        id: "example-total-blocks",
        name: this.i18n.exampleNameTotalBlocks,
        code: `// Counts all document blocks on the remote device via SQL.
const res = await request("/api/query/sql", { stmt: "SELECT COUNT(*) AS total FROM blocks" });
return res?.[0]?.total ?? res;`,
      },
      {
        id: "example-recent-docs",
        name: this.i18n.exampleNameRecentDocs,
        code: `// Returns the 10 most recently updated documents on the remote device.
// Keep the payload small (id + hpath only): GoEasy caps a message at ~5KB.
return await request("/api/query/sql", {
  stmt: "SELECT id, hpath FROM blocks WHERE type = 'd' ORDER BY updated DESC LIMIT 10"
});`,
      },
      {
        id: "example-open-calculator",
        name: this.i18n.exampleNameOpenCalculator,
        code: `// Opens the Calculator app on the remote device (cross-platform).
// Demonstrates reaching Node from SiYuan's Electron renderer via window.require.
// Desktop-only: on mobile/browser/dock-window frontends window.require is absent.
if (typeof window.require !== "function") {
  return {
    ok: false,
    error: "Node bridge (window.require) is not available on this frontend. "
         + "Run this on SiYuan Desktop (Electron) on the remote device.",
  };
}
const { spawn } = window.require("child_process");
const os = window.require("os");
const platform = os.platform(); // "darwin" | "win32" | "linux"
const commands = {
  darwin: ["open", "-a", "Calculator"],
  win32:  ["cmd.exe", "/c", "start", "", "calc"],
  linux:  ["xdg-open", "/usr/share/applications/org.gnome.Calculator.desktop"],
};
const cmd = commands[platform];
if (!cmd) {
  return { ok: false, error: "Unsupported platform: " + platform };
}
// Detached + unref so the child neither blocks the snippet nor keeps SiYuan alive.
const child = spawn(cmd[0], cmd.slice(1), { detached: true, stdio: "ignore" });
child.unref();
return {
  ok: true,
  platform,
  command: cmd.join(" "),
  pid: child.pid,
  note: "Calculator launch requested; the window should appear on the remote desktop shortly.",
};`,
      },
    ];
  }

  async restoreOfficialExamples() {
    const examples = this.getOfficialExampleSnippets();
    const existing = this.getSnippets();
    // Merge: keep user snippets, add any official example whose id isn't already present.
    const existingIds = new Set(existing.map((s) => s.id));
    const merged = [...existing, ...examples.filter((e) => !existingIds.has(e.id))];
    await this.saveSnippets(merged);
    showMessage(this.i18n.textExamplesRestored, 3000);
  }

  async seedOfficialExamplesIfFirstRun() {
    // Seed the official examples only the very first time the user opens the feature,
    // tracked by a persistent flag so deleting them does NOT re-trigger seeding.
    const seeded = this.settingUtils.get("codeSnippetsSeeded");
    if (seeded) return;
    if (this.getSnippets().length === 0) {
      await this.saveSnippets(this.getOfficialExampleSnippets());
    }
    await this.settingUtils.setAndSave("codeSnippetsSeeded", true);
  }

  showPasswordHistoryDialog() {
    const history = this.settingUtils.get("passwordHistory") || this.i18n.textNoPasswordHistory;
    const dialog = new Dialog({
      title: this.i18n.textPasswordHistoryTitle,
      content: `<div class="b3-dialog__content">
        <textarea class="b3-text-field fn__block" readonly style="height: 300px; font-family: monospace;">${history}</textarea>
      </div>
      <div class="b3-dialog__action">
        <button class="b3-button b3-button--text">${window.siyuan.languages.confirm}</button>
      </div>`,
      width: this.isMobile ? "95vw" : "600px",
    });
    dialog.element.querySelector(".b3-button").addEventListener("click", () => dialog.destroy());
  }

  onLockScreen() {
    lockScreen(this.app);
  }

  async onunload() {
    if (this.goEasyService) {
      this.goEasyService.disconnect();
    }
  }

  uninstall() {}

  passwordDoubleCheckDialog = (args: {
    confirm?: (password: string) => void;
    cancel?: () => void;
  }) => {
    const dialog = new Dialog({
      title: this.i18n.textSetAutoPassword,
      content: `<div class="b3-dialog__content">
      <div class="ft__breakword" style="margin-bottom: 12px;">
        <div style="margin-bottom: 8px; opacity: 0.8;">${this.i18n.textSetAutoPasswordPlaceholder}</div>
        <textarea class="b3-text-field fn__block" id="pwdInput1" style="height: 80px;" placeholder="${this.i18n.textSetAutoPassword}"></textarea>
      </div>
      <div class="ft__breakword">
        <div style="margin-bottom: 8px; opacity: 0.8;">${this.i18n.textSetAutoPasswordConfirmPlaceholder}</div>
        <textarea class="b3-text-field fn__block" id="pwdInput2" style="height: 80px;" placeholder="${this.i18n.textSetAutoPasswordConfirm}"></textarea>
      </div>
  </div>
  <div class="b3-dialog__action">
      <button class="b3-button b3-button--cancel">${window.siyuan.languages.cancel}</button><div class="fn__space"></div>
      <button class="b3-button b3-button--text" id="confirmPwdBtn">${window.siyuan.languages.confirm}</button>
  </div>`,
      width: this.isMobile ? "95vw" : "520px",
    });

    const pwdInput1: HTMLTextAreaElement = dialog.element.querySelector("#pwdInput1");
    const pwdInput2: HTMLTextAreaElement = dialog.element.querySelector("#pwdInput2");
    const btnsElement = dialog.element.querySelectorAll(".b3-button");

    btnsElement[0].addEventListener("click", () => {
      if (args?.cancel) args.cancel();
      dialog.destroy();
    });

    btnsElement[1].addEventListener("click", () => {
      if (pwdInput1.value === pwdInput2.value) {
        if (args?.confirm) args.confirm(pwdInput1.value);
        dialog.destroy();
      } else {
        showMessage(this.i18n.textPasswordMismatch, 5000, "error");
      }
    });

    setTimeout(() => pwdInput1.focus(), 100);
  };

  showManageSnippetsDialog = () => {
    const dialog = new Dialog({
      title: this.i18n.textManageSnippets,
      content: `<div class="b3-dialog__content">
        <div id="snippetListContainer" class="snippet-list"></div>
      </div>
      <div class="b3-dialog__action">
        <button class="b3-button b3-button--cancel">${window.siyuan.languages.cancel}</button><div class="fn__space"></div>
        <button class="b3-button b3-button--outline" id="restoreExamplesBtn">${this.i18n.textRestoreExamples}</button><div class="fn__space"></div>
        <button class="b3-button b3-button--text" id="addSnippetBtn">${this.i18n.textAddSnippet}</button>
      </div>`,
      width: this.isMobile ? "95vw" : "600px",
    });

    const renderList = () => {
      const container = dialog.element.querySelector("#snippetListContainer");
      if (!container) return;
      const snippets = this.getSnippets();
      if (snippets.length === 0) {
        container.innerHTML = `<div class="snippet-manager-empty">${this.i18n.textNoSnippets}</div>`;
        return;
      }
      container.innerHTML = snippets
        .map(
          (s) => `
        <div class="snippet-row">
          <span class="snippet-name">${this.escapeHtml(s.name)}</span>
          <span class="snippet-actions">
            <button class="b3-button b3-button--outline snippet-edit" data-id="${s.id}">${this.i18n.textEditSnippet}</button>
            <button class="b3-button b3-button--cancel snippet-delete" data-id="${s.id}">${this.i18n.textDeleteSnippet}</button>
          </span>
        </div>`
        )
        .join("");

      container.querySelectorAll(".snippet-edit").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = (btn as HTMLElement).getAttribute("data-id");
          const snippet = this.getSnippets().find((s) => s.id === id);
          if (snippet) {
            dialog.destroy();
            this.showSnippetEditDialog(snippet, () => this.showManageSnippetsDialog());
          }
        });
      });
      container.querySelectorAll(".snippet-delete").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const id = (btn as HTMLElement).getAttribute("data-id");
          if (!id) return;
          const confirmed = await this.confirmDialog({
            title: this.i18n.textDeleteSnippet,
            message: this.i18n.textConfirmDeleteSnippet,
          });
          if (!confirmed) return;
          const list = this.getSnippets().filter((s) => s.id !== id);
          await this.saveSnippets(list);
          renderList();
        });
      });
    };

    dialog.element
      .querySelector(".b3-dialog__action .b3-button--cancel")
      .addEventListener("click", () => dialog.destroy());
    dialog.element
      .querySelector("#restoreExamplesBtn")
      .addEventListener("click", async () => {
        await this.restoreOfficialExamples();
        renderList();
      });
    dialog.element
      .querySelector("#addSnippetBtn")
      .addEventListener("click", () => {
        dialog.destroy();
        this.showSnippetEditDialog(null, () => this.showManageSnippetsDialog());
      });

    renderList();
  };

  showSnippetEditDialog = (
    snippet: CodeSnippet | null,
    onClosed?: () => void
  ) => {
    const isEdit = snippet !== null;
    const dialog = new Dialog({
      title: isEdit ? this.i18n.textEditSnippet : this.i18n.textAddSnippet,
      content: `<div class="b3-dialog__content">
        <div class="ft__breakword" style="margin-bottom: 8px;">
          <div style="margin-bottom: 4px; opacity: 0.8;">${this.i18n.textSnippetName}</div>
          <input class="b3-text-field fn__block" id="snippetNameInput" placeholder="${this.i18n.textSnippetNamePlaceholder}" value="${isEdit ? this.escapeHtml(snippet.name) : ""}" />
        </div>
        <div class="ft__breakword">
          <div style="margin-bottom: 4px; opacity: 0.8;">${this.i18n.textSnippetCode}</div>
          <textarea class="b3-text-field fn__block" id="snippetCodeInput" style="height: 240px; font-family: monospace;" placeholder="${this.i18n.textSnippetCodePlaceholder}">${isEdit ? this.escapeHtml(snippet.code) : ""}</textarea>
        </div>
      </div>
      <div class="b3-dialog__action">
        <button class="b3-button b3-button--cancel">${window.siyuan.languages.cancel}</button><div class="fn__space"></div>
        <button class="b3-button b3-button--text" id="saveSnippetBtn">${window.siyuan.languages.save}</button>
      </div>`,
      width: this.isMobile ? "95vw" : "640px",
    });

    const nameInput: HTMLInputElement = dialog.element.querySelector(
      "#snippetNameInput"
    );
    const codeInput: HTMLTextAreaElement = dialog.element.querySelector(
      "#snippetCodeInput"
    );
    const btnsElement = dialog.element.querySelectorAll(".b3-button");

    btnsElement[0].addEventListener("click", () => {
      dialog.destroy();
      if (onClosed) onClosed();
    });

    btnsElement[1].addEventListener("click", async () => {
      const name = nameInput.value.trim();
      const code = codeInput.value;
      if (!name) {
        showMessage(this.i18n.textSnippetNameEmpty, 5000, "error");
        return;
      }
      const list = this.getSnippets();
      if (isEdit) {
        const idx = list.findIndex((s) => s.id === snippet.id);
        if (idx >= 0) {
          list[idx] = { id: snippet.id, name, code };
        }
      } else {
        list.push({ id: crypto.randomUUID(), name, code });
      }
      await this.saveSnippets(list);
      dialog.destroy();
      if (onClosed) onClosed();
    });

    setTimeout(() => nameInput.focus(), 100);
  };

  showSnippetPickerDialog = (
    deviceId: string,
    onPicked: (deviceId: string, snippet: CodeSnippet) => void
  ) => {
    const snippets = this.getSnippets();
    if (snippets.length === 0) {
      showMessage(this.i18n.textNoSnippets, 5000, "error");
      return;
    }
    const dialog = new Dialog({
      title: this.i18n.textPickSnippet,
      content: `<div class="b3-dialog__content">
        <div class="snippet-list">
          ${snippets
            .map(
              (s) => `
            <button class="snippet-picker-item b3-button b3-button--outline" data-id="${s.id}" data-device-id="${this.escapeHtml(deviceId)}">
              <span class="snippet-picker-name">${this.escapeHtml(s.name)}</span>
              <span class="snippet-picker-preview">${this.escapeHtml(s.code)}</span>
            </button>`
            )
            .join("")}
        </div>
      </div>
      <div class="b3-dialog__action">
        <button class="b3-button b3-button--cancel">${window.siyuan.languages.cancel}</button>
      </div>`,
      width: this.isMobile ? "95vw" : "600px",
    });

    dialog.element
      .querySelectorAll(".snippet-picker-item")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = (btn as HTMLElement).getAttribute("data-id");
          const did = (btn as HTMLElement).getAttribute("data-device-id");
          const snippet = this.getSnippets().find((s) => s.id === id);
          dialog.destroy();
          if (snippet && did) onPicked(did, snippet);
        });
      });
    dialog.element
      .querySelector(".b3-dialog__action .b3-button--cancel")
      .addEventListener("click", () => dialog.destroy());
  };

  showSnippetResultDialog = (title: string, resultText: string) => {
    const dialog = new Dialog({
      title: title,
      content: `<div class="b3-dialog__content">
        <textarea class="b3-text-field fn__block" readonly style="height: 300px; font-family: monospace;">${this.escapeHtml(resultText)}</textarea>
      </div>
      <div class="b3-dialog__action">
        <button class="b3-button b3-button--cancel">${this.i18n.textCopyResult}</button><div class="fn__space"></div>
        <button class="b3-button b3-button--text">${window.siyuan.languages.close}</button>
      </div>`,
      width: this.isMobile ? "95vw" : "640px",
    });
    const btnsElement = dialog.element.querySelectorAll(".b3-button");
    btnsElement[0].addEventListener("click", () => {
      this.clipboardService.copyToClipboard(resultText);
      showMessage(this.i18n.textCopied, 2000);
    });
    btnsElement[1].addEventListener("click", () => dialog.destroy());
  };

  confirmDialog = (args: {
    title: string;
    message: string;
  }): Promise<boolean> => {
    return new Promise((resolve) => {
      const dialog = new Dialog({
        title: args.title,
        content: `<div class="b3-dialog__content">
          <div class="ft__breakword">${args.message}</div>
        </div>
        <div class="b3-dialog__action">
          <button class="b3-button b3-button--cancel">${window.siyuan.languages.cancel}</button><div class="fn__space"></div>
          <button class="b3-button b3-button--text" id="confirmDialogConfirmBtn">${window.siyuan.languages.confirm}</button>
        </div>`,
        width: this.isMobile ? "95vw" : "480px",
      });
      const btnsElement = dialog.element.querySelectorAll(".b3-button");
      btnsElement[0].addEventListener("click", () => {
        dialog.destroy();
        resolve(false);
      });
      btnsElement[1].addEventListener("click", () => {
        dialog.destroy();
        resolve(true);
      });
    });
  };

  escapeHtml = (text: string): string => {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  runSnippetOnDevice(deviceId: string, snippet: CodeSnippet) {
    const id = crypto.randomUUID();
    const from = this.deviceService.getCurrentDeviceInfo();
    showMessage(this.i18n.textSnippetRunning, 3000);
    console.log(
      `[snippet-run] request id=${id} localRunnerVersion=${SNIPPET_RUNNER_VERSION} snippet=${snippet.name}`
    );

    new Promise<{ result: any; runnerVersion: string | null }>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.pendingSnippetRuns.has(id)) {
          this.pendingSnippetRuns.delete(id);
          reject(Object.assign(new Error("timeout"), { runnerVersion: null }));
        }
      }, 30000);
      this.pendingSnippetRuns.set(id, {
        resolve,
        reject,
        timeoutId,
      });
      this.goEasyService.sendMessage(
        deviceId +
          "#runSnippet#" +
          JSON.stringify({
            id,
            code: snippet.code,
            from,
            localRunnerVersion: SNIPPET_RUNNER_VERSION,
          })
      );
    })
      .then(({ result, runnerVersion }) => {
        const text =
          typeof result === "string" ? result : JSON.stringify(result, null, 2);
        const versionTag = runnerVersion
          ? ` (remote runner: ${runnerVersion})`
          : "";
        this.showSnippetResultDialog(
          this.i18n.textSnippetResult + " — " + snippet.name + versionTag,
          text
        );
      })
      .catch((err) => {
        const remoteVersion = err?.runnerVersion;
        const isTimeout = err?.message === "timeout";
        let msg;
        if (isTimeout) {
          msg = this.i18n.textSnippetTimeout;
        } else {
          msg =
            this.i18n.textSnippetRunFail +
            (err?.message ? ": " + err.message : "");
        }
        if (remoteVersion) {
          msg += ` [remote runner: ${remoteVersion}`;
          if (remoteVersion !== SNIPPET_RUNNER_VERSION) {
            msg += ` ≠ local ${SNIPPET_RUNNER_VERSION} — remote needs plugin redeploy`;
          }
          msg += "]";
        } else if (isTimeout) {
          msg += ` [no response — remote may be offline, on a stale build, or a mobile WebView that rejects the snippet]`;
        }
        showMessage(msg, 12000, "error");
      });
  }

  async currentDeviceInList() {
    try {
      var current_device_info = await this.deviceService.getCurrentDeviceInfo();

      console.log(current_device_info);

      var enableDeviceList = await this.settingUtils.get("enableDeviceList");

      console.log(enableDeviceList);

      var enableDeviceListArray = enableDeviceList.split("\n");

      console.log(enableDeviceListArray);

      return enableDeviceListArray.includes(current_device_info);

    } catch (error) {
      console.error("Error checking if current device is enabled:", error);
    }
  }

  async appendCurrentDeviceIntoList() {
    try {
      // 注意await
      var current_device_info = await this.deviceService.getCurrentDeviceInfo();

      var enableDeviceList = this.settingUtils.get("enableDeviceList");
      var enableDeviceListArray = enableDeviceList.split("\n");
      var enableDeviceListArrayLength = enableDeviceListArray.length;
      var enableDeviceListArrayLast =
        enableDeviceListArray[enableDeviceListArrayLength - 1];

      // remove empty line
      if (enableDeviceListArrayLast === "") {
        enableDeviceListArray.pop();
      }

      enableDeviceListArray.push(current_device_info);

      var enableDeviceListArrayString = enableDeviceListArray.join("\n");

      this.settingUtils.assignValue(
        "enableDeviceList",
        enableDeviceListArrayString
      );
      this.settingUtils.save();
    } catch (error) {
      console.error("Error appending current device into list:", error);
    }
  }

  async removeCurrentDeviceFromList() {
    try {
      var current_device_info = await this.deviceService.getCurrentDeviceInfo();

      var enableDeviceList = this.settingUtils.get("enableDeviceList");
      var enableDeviceListArray = enableDeviceList.split("\n");

      // make sure visited the entire list
      for (var i = enableDeviceListArray.length - 1; i >= 0; i--) {
        var deviceInfo = enableDeviceListArray[i];

        if (deviceInfo == current_device_info) {
          enableDeviceListArray.splice(i, 1);
        }
      }

      // reassemble list
      var enableDeviceListArrayString = enableDeviceListArray.join("\n");

      this.settingUtils.assignValue(
        "enableDeviceList",
        enableDeviceListArrayString
      );
      this.settingUtils.save();
    } catch (error) {
      console.error("Error removing current device from list:", error);
    }
  }

  inputDialog = (args: {
    title: string;
    placeholder?: string;
    defaultText?: string;
    confirm?: (text: string) => void;
    cancel?: () => void;
    width?: string;
    height?: string;
  }) => {
    const autoMode = this.settingUtils.get("autoMode");
    const inputBoxHeight = this.isMobile ? "65vw" : "22vw";
    const dialog = new Dialog({
      title: args.title,
      content: `<div class="b3-dialog__content">
      <div class="ft__breakword"><textarea class="b3-text-field fn__block" style="height: ${inputBoxHeight};" placeholder="${
        args?.placeholder ?? ""
      }">${args?.defaultText ?? ""}</textarea></div>
  </div>
  <div class="b3-dialog__action">
      <button class="b3-button b3-button--cancel">${
        window.siyuan.languages.cancel
      }</button><div class="fn__space"></div>
      <button class="b3-button b3-button--text" id="confirmDialogConfirmBtn">${
        window.siyuan.languages.confirm
      }</button>
  </div>`,
      width: args.width ?? "520px",
      height: args.height,
    });
    const target: HTMLTextAreaElement = dialog.element.querySelector(
      ".b3-dialog__content>div.ft__breakword>textarea"
    );
    const btnsElement = dialog.element.querySelectorAll(".b3-button");
    btnsElement[0].addEventListener("click", () => {
      if (args?.cancel) {
        args.cancel();
      }
      dialog.destroy();
    });

    if (!autoMode) {
      btnsElement[1].addEventListener("click", () => {
        if (args?.confirm) {
          args.confirm(target.value);
        }
        dialog.destroy();
      });
    } else if (autoMode) {
      target.addEventListener("paste", () => {
        setTimeout(() => {
          if (args?.confirm) {
            args.confirm(target.value);
          }
          dialog.destroy();
        }, 0);
      });
    }

    for (let i = 0; i < 5; i++) {
      //this is for focus dialog inputbox...
      setTimeout(() => {
        target.focus();
      }, 1);
    }
  };
}
