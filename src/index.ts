import { Plugin, showMessage, getFrontend, getBackend, IModel } from "siyuan";
import "@/index.scss";

import { SettingUtils } from "./libs/setting-utils";

const STORAGE_NAME = "menu-config";
var already_noticed_this_boot = false;

export default class PluginSample extends Plugin {
  async sendBarkNotification(title: string, body: string) {
    try {
      var barkApiBaseLink = this.settingUtils.get("barkApiBaseLink");
      var url = barkApiBaseLink + "/" + title + "/" + body;
      var response = await fetch(url);
      var result = await response.json();

      if (this.settingUtils.get("displayNoticeWhenBarkNotiSent")) {
        showMessage("Bark notification sent: " + result.code);
        console.log("Bark notification sent: " + result.code);
      }
    } catch (error) {
      console.error("Error sending bark notification:", error);
    }
  }

  async sendBarkDeviceOnlineNotification() {
    if (!already_noticed_this_boot) {
      try {
        var current_device_info = await this.fetchCurrentDeviceInfo();
        var title = this.i18n.barkOnlineNoticeTitle;
        var body =
          this.i18n.barkOnlineNoticeContentHeader + current_device_info;

        this.sendBarkNotification(title, body);
        already_noticed_this_boot = true;
      } catch (error) {
        console.error("Error sending bark device online notification:", error);
        already_noticed_this_boot = false;
      }
    }
  }

  customTab: () => IModel;
  private isMobile: boolean;
  private settingUtils: SettingUtils;

  async onload() {
    this.data[STORAGE_NAME] = { readonlyText: "Readonly" };

    // console.log("loading plugin-sample", this.i18n);

    const frontEnd = getFrontend();
    this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";

    this.settingUtils = new SettingUtils({
      plugin: this,
      name: STORAGE_NAME,
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
      key: "barkApiBaseLink",
      value: "",
      type: "textinput",
      title: this.i18n.barkApiBaseLink,
      description: this.i18n.barkApiBaseLinkDesc,
      action: {
        // Called when focus is lost and content changes
        callback: () => {
          let value = this.settingUtils.takeAndSave("barkApiBaseLink");
        //   console.log(value);
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
          let value = !this.settingUtils.get("mainSwitch");
          this.settingUtils.set("mainSwitch", value);
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

    try {
      this.settingUtils.load();
    } catch (error) {
      console.error(
        "Error loading settings storage, probably empty config json:",
        error
      );
    }
  }

  onLayoutReady() {
    // this.loadData(STORAGE_NAME);
    this.settingUtils.load();
    // console.log(`frontend: ${getFrontend()}; backend: ${getBackend()}`);

    // within layoutready async caller sample
    const layoutReadyAsyncHandler = async () => {
      try {
        /*分设备caller真值表：
                当前设备真， 仅允许开关开，后半段为假 ：真||假： 执行
                当前设备真， 仅允许开关关，后半段为真 ：真||真： 执行
                当前设备假， 仅允许开关开，后半段为假 ：假||假： 不执行
                当前设备假， 仅允许开关关，后半段为真 ：假||真： 执行
                */
        if (
          (await this.currentDeviceInList()) ||
          !this.settingUtils.get("onlyEnableListedDevices")
        ) {
          if (
            this.settingUtils.get("mainSwitch") &&
            this.settingUtils.get("barkApiBaseLink") != ""
          ) {
            this.sendBarkDeviceOnlineNotification();
          }
        //   console.log(
        //     "per device enable logic: true\nAKA device in list or onlyEnableListedDevices is false"
        //   );
        } else {
        //   console.log(
        //     "per device enable logic: false\nAKA device not in list and onlyEnableListedDevices is true"
        //   );
        }
      } catch (error) {
        console.error("within layoutready async caller calling fail", error);
      }
    };
    layoutReadyAsyncHandler();
  }

  async onunload() {}

  uninstall() {}

  async currentDeviceInList() {
    try {
      var current_device_info = await this.fetchCurrentDeviceInfo();

      var enableDeviceList = await this.settingUtils.get("enableDeviceList");
      var enableDeviceListArray = enableDeviceList.split("\n");

      return enableDeviceListArray.includes(current_device_info);
    } catch (error) {
      console.error("Error checking if current device is enabled:", error);
    }
  }

  fetchCurrentDeviceInfo(): Promise<string> {
    var current_device_uuid = window.siyuan.config.system.id;
    var current_device_name = window.siyuan.config.system.name;
    var current_device_info = current_device_uuid + " " + current_device_name;

    return Promise.resolve(current_device_info.toString());
  }

  async appendCurrentDeviceIntoList() {
    try {
      // 注意await
      var current_device_info = await this.fetchCurrentDeviceInfo();

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
      var current_device_info = await this.fetchCurrentDeviceInfo();

      var enableDeviceList = this.settingUtils.get("enableDeviceList");
      var enableDeviceListArray = enableDeviceList.split("\n");

      // make sure visited the entire list
      for (var i = enableDeviceListArray.length - 1; i >= 0; i--) {
        var deviceInfo = enableDeviceListArray[i];

        if (deviceInfo === current_device_info) {
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
}
