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
import { NotificationService } from "./services/notificationService";
import { ClipboardService } from "./services/clipboardService";

const STORAGE_NAME = "menu-config";
const DOCK_TYPE = "dock_tab";
var already_noticed_this_boot = false;

export default class SiyuanOnlineDeviceManager extends Plugin {
  private goEasyService: GoEasyService;
  private deviceService: DeviceService;
  private notificationService: NotificationService;
  private clipboardService: ClipboardService;
  private pendingLocks: Map<string, any> = new Map();

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
      key: "Hint",
      value: "",
      type: "hint",
      title: this.i18n.hintTitle,
      description: this.i18n.hintDesc,
    });
  }

  handleMessage = async (message: any, deviceInfo: string) => {
    const parts = message.content.split("#");
    const receivedDevice = parts[0];
    const receivedCommand = parts[1];
    const receivedContent = parts[2];

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
    if (this.settingUtils.get("goeasySwitch")) {
      if (token) {
        // GoEasy service with message handler
        this.goEasyService = new GoEasyService(
          token,
          this.handleMessage,
          this.updateDeviceListFromPresence
        );
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
      this.goEasyService.connect(deviceInfo);
    }
  }

  onLayoutReady() {
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
          },
          destroy() {
            console.log("destroy dock:", DOCK_TYPE);
          },
        });
      }

      this.handleLayoutReadyAsync();
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
        
        deviceListHtml +=
          member.id == this.deviceService.getCurrentDeviceInfo() //local machine or not
            ? ` 
          <div class="device-item">
            <div class="device-info">
              <div class="device-name">${this.i18n.textDeviceName}${member.data.deviceName}</div>
              <div class="device-uuid">${this.i18n.textDeviceUuid}${member.data.deviceUuid}</div>
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
              <div class="device-name">${this.i18n.textDeviceName}${member.data.deviceName}</div>
              <div class="device-uuid">${this.i18n.textDeviceUuid}${member.data.deviceUuid}</div>
            </div>
            <div class="device-actions">
              <button class="${lockClass} b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}">${lockIcon} ${this.i18n.textLock}</button>
              <button class="device-action exit-siyuan b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}"><svg class="svg"><use xlink:href="#iconQuit"></use></svg> ${this.i18n.textExit}</button>
              <button class="device-action send-human-msg b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}"><svg class="svg"><use xlink:href="#iconEmail"></use></svg> ${this.i18n.textSendMessage}</button>
              <button class="device-action send-clipboard b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}"><svg class="svg"><use xlink:href="#iconPaste"></use></svg> ${this.i18n.textSendToClipboard}</button>
              <button class="device-action trigger-sync b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}"><svg class="svg"><use xlink:href="#iconCloud"></use></svg> ${this.i18n.textTriggerSync}</button>
              <button class="device-action set-auto-password b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}"><svg class="svg"><use xlink:href="#iconLock"></use></svg> ${this.i18n.textSetAutoPassword}</button>


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

  addDeviceActionListeners() {
    const actionButtons = document.querySelectorAll(".device-action");
    actionButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        const target = e.target as HTMLElement;
        const deviceId = target.getAttribute("data-device-id");
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
          : null;
        if (deviceId && action) {
          this.performDeviceAction(deviceId, action);
        }
      });
    });
  }

  performDeviceAction(deviceId: string, action: string) {
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
