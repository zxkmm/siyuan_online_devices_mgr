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

    console.log(
      "Current device: " + this.deviceService?.getCurrentDeviceInfo()
    );
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
      key: "Hint",
      value: "",
      type: "hint",
      title: this.i18n.hintTitle,
      description: this.i18n.hintDesc,
    });
  }

  handleMessage = (message: any, deviceInfo: string) => {
    const parts = message.content.split("#");
    const receivedDevice = parts[0];
    const receivedCommand = parts[1];
    const receivedContent = parts[2];

    switch (receivedCommand) {
      case "lockScreen":
        if (receivedDevice === deviceInfo) {
          this.deviceService.lockCurrentDevice();
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
          this.deviceService.syncCurrentDevice();
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

    // GoEasy service with message handler
    this.goEasyService = new GoEasyService(
      this.settingUtils.get("goeasyToken"),
      this.handleMessage,
      this.updateDeviceListFromPresence
    );

    // device service
    this.deviceService = new DeviceService(
      this.goEasyService,
      () => this.onLockScreen() // this got to be callback bc ONLY this base plugin class can call lockScreen(this.app) somehow.
    );
    // connect to GoEasy
    const deviceInfo = this.deviceService.getCurrentDeviceInfo();
    this.goEasyService.connect(deviceInfo);
  }

  onLayoutReady() {
    if (
      this.settingUtils.get("mainSwitch") &&
      this.settingUtils.get("goeasySwitch") &&
      this.settingUtils.get("goeasyToken")
    ) {
      this.initializeServices();

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

    this.settingUtils.load();

    this.handleLayoutReadyAsync();
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
      response.content.members.forEach((member) => {
        // console.log("mem:", member.id);
        deviceListHtml +=
          member.id == this.deviceService.getCurrentDeviceInfo() //local machine or not
            ? ` 
          <div class="device-item">
            <div class="device-info">
              <div class="device-name">${this.i18n.textDeviceName}${member.data.deviceName}</div>
              <div class="device-uuid">${this.i18n.textDeviceUuid}${member.data.deviceUuid}</div>
            </div>
            <div class="device-actions">
            <span class="device-action device-itsme b3-button b3-button--outline fn__flex-center" style="opacity: 0.8; pointer-events: none;">${this.i18n.textLocalMachine}</span>
            <button class="device-action lock-siyuan b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}" style="display: none;">${this.i18n.textLock}</button>
            <button class="device-action exit-siyuan b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}" style="display: none;">${this.i18n.textExit}</button>
            <button class="device-action send-human-msg b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}" style="display: none;">${this.i18n.textSendMessage}</button>
            <button class="device-action send-clipboard b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}" style="display: none;">${this.i18n.textSendToClipboard}</button>
            <button class="device-action trigger-sync b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}" style="display: none;">${this.i18n.textTriggerSync}</button>
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
              <button class="device-action lock-siyuan b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}">${this.i18n.textLock}</button>
              <button class="device-action exit-siyuan b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}">${this.i18n.textExit}</button>
              <button class="device-action send-human-msg b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}">${this.i18n.textSendMessage}</button>
              <button class="device-action send-clipboard b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}">${this.i18n.textSendToClipboard}</button>
              <button class="device-action trigger-sync b3-button b3-button--outline fn__flex-center" data-device-id="${member.id}">${this.i18n.textTriggerSync}</button>


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
          title: "发送广域消息",
          placeholder: "例如：ping测试！",
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
          title: "发送广域剪贴板",
          placeholder:
            "这回发送给所有在线设备。请注意：如果目标设备没有剪贴板管理器，则你之前的剪贴板内容会被覆盖且无法找回。",
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
        this.deviceService.lockDevice(deviceId);
        break;
      case "exit-siyuan":
        this.deviceService.exitDevice(deviceId);
        console.log("Exit device:", deviceId);
        break;
      case "send-human-msg":
        this.inputDialog({
          title: "发送消息",
          placeholder: "例如：别偷看我笔记！",
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
          title: "发送到剪贴板",
          placeholder:
            "此将会发送内容到目标设备的剪贴板。请注意，如果目标设备没有剪贴板管理器，则你之前的剪贴板内容会被覆盖且无法找回。",
          width: this.isMobile ? "95vw" : "70vw",
          height: this.isMobile ? "95vw" : "30vw",
          confirm: (text: string) => {
            this.goEasyService.sendMessage(deviceId + "#clipboard#" + text);
            //TODO: more thigns here maybe
          },
        });
        break;
      case "trigger-sync":
        this.deviceService.triggerSync(deviceId + "#triggerSync#nullptr");

      
    }
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

  async currentDeviceInList() {
    try {
      var current_device_info = await this.deviceService.getCurrentDeviceInfo();

      var enableDeviceList = await this.settingUtils.get("enableDeviceList");
      var enableDeviceListArray = enableDeviceList.split("\n");

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
      <div class="ft__breakword"><textarea class="b3-text-field fn__block" style="height: ${inputBoxHeight};" placeholder=${
        args?.placeholder ?? ""
      }>${args?.defaultText ?? ""}</textarea></div>
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
