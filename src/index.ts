import {
  Plugin,
  showMessage,
  getFrontend,
  getBackend,
  Dialog,
  IModel,
  adaptHotkey,
  lockScreen,
} from "siyuan";
import "@/index.scss";
import GoEasy from "goeasy-lite";

import { SettingUtils } from "./libs/setting-utils";
import { getDockHTML } from "./dock-template";
import { Client } from "@siyuan-community/siyuan-sdk";

const STORAGE_NAME = "menu-config";
const DOCK_TYPE = "dock_tab";
var already_noticed_this_boot = false;

const client = new Client({});

export default class SiyuanOnlineDeviceManager extends Plugin {
  private goeasy: any;

  async initGoeasy() {
    //all code in this func is from goeasy document
    var deviceInfo = this.fetchCurrentDeviceInfoAwait();
    // var deviceInfo = "123^abc";
    var deviceName = deviceInfo.split("^")[1];
    var deviceUuid = deviceInfo.split("^")[0];

    this.goeasy.connect({
      id: deviceInfo,
      data: { deviceUuid: deviceUuid, deviceName: deviceName }, //可扩展更多的成员信息，查询或监听成员上下线事件时，event对象将包含id和data
      onSuccess: function () {
        //连接成功
        console.log("GoEasy connect successfully."); //连接成功
      },
      onFailed: function (error) {
        //连接失败
        console.log(
          "Failed to connect GoEasy, code:" +
          error.code +
          ",error:" +
          error.content,
        );
      },
      onProgress: function (attempts) {
        //连接或自动重连中
        console.log("GoEasy is connecting", attempts);
      },
    });

    this.goeasy.pubsub.subscribe({
      channel: "online_devices", //替换为您自己的channel
      presence: {
        enable: true,
      },
      onMessage: (message) => {
        //收到消息
        console.log(
          "Channel:" + message.channel + " content:" + message.content,
        );
        this.handleMessage(message, deviceInfo);
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
      membersLimit: 20, //可选项，定义返回的最新上线成员列表的数量，默认为10，最多支持返回100个成员
      onPresence: (presenceEvent) => {
        //lambda making sure the this still has correct context
        console.log("Presence events: ", JSON.stringify(presenceEvent));
        this.updateDeviceListFromPresence(presenceEvent); //TODO: debounce
        // {
        //     action: 'join',
        //     member: {id: 'user001', data: {avatar:'/www/xxx4.png', nickname: 'Tom'}},
        //     amount: 3000, //当前订阅该channel的在线成员总数
        //     memebers: [  //最新上线的20个成员列表
        //         {id: 'user001', data: {avatar:'/www/xxx1.png', nickname: 'Neo'}},
        //         {id: 'user002', data: {avatar:'/www/xxx2.png', nickname: 'Lucy'}},
        //          ....
        //         {id: 'user003', data: {avatar:'/www/xxx3.png', nickname: 'Jack'}},
        //     ]
        // }
      },
      onSuccess: function () {
        //监听成功
        console.log("subscribe presence successfully.");
      },
      onFailed: function (error) {
        //监听失败
        console.log(
          "Failed to subscribe presence, code:" +
          error.code +
          ",error:" +
          error.content,
        );
      },
    });

    this.goeasy.pubsub.hereNow({
      channel: "online_devices",
      limit: 20, //可选项，定义返回的最新上线成员列表的数量，默认为10，最多支持返回最新上线的100个成员
      onSuccess: function (response) {
        //获取成功
        console.log("hereNow response: " + JSON.stringify(response)); //json格式的response
        /**
            response示例:
            {
               "code": 200,
               "content": {
                        "channel": "my_channel",
                        "amount": 30000,    //在线成员总数
                        "members": [    //最新在线的100个成员信息
                           {"id":"Jack","data":{"avatar":"/www/xxx.png","nickname":"Jack"}}, //在线用户
                           {"id":"Ted","data":{"avatar":"/www/xxx.png","nickname":"Ted"}}
                        ]
                  }
               }
            }
            **/
      },
      onFailed: function (error) {
        //获取失败
        console.log(
          "Failed to obtain online clients, code:" +
          error.code +
          ",error:" +
          error.content,
        );
      },
    });
  }

  updateDeviceListFromPresence(presenceEvent: any) {
    this.updateOnlineDeviceList();
  }

  handleMessage(message, deviceInfo) {
    const parts = message.content.split("#");
    const receivedDevice = parts[0];
    const receivedCommand = parts[1];
    const receivedContent = parts[2];

    switch (receivedCommand) {
      case "lockScreen":
        if (receivedDevice == deviceInfo) {
          this.lockCurrentDevice();
        }
        break;
      case "exitSiyuan":
        if (receivedDevice == deviceInfo) {
          this.exitCurrentDevice();
        }
        break;
      case "humanMessage":
        console.log("humanMessage");
        if (receivedDevice == "ALL" || receivedDevice == deviceInfo) {
          showMessage(receivedContent);
        }
        break;
      default:
        console.log("Unknown command:", receivedCommand);
    }
  }

  async sendGoeasyMsg(_message_) {
    GoEasy.pubsub.publish({
      channel: "online_devices", //替换为您自己的channel
      message: _message_, //替换为您想要发送的消息内容
      onSuccess: function () {
        console.log("消息发布成功。");
      },
      onFailed: function (error) {
        console.log(
          "消息发送失败，错误编码：" +
          error.code +
          " 错误信息：" +
          error.content,
        );
      },
    });
  }

  fetchOnlineDevices(callback: (response: any) => void) {
    GoEasy.pubsub.hereNow({
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

  async lockByDeviceInfo(_deviceInfo_) {
    console.log("lock by dev info");
    this.sendGoeasyMsg(_deviceInfo_ + "#lockScreen#nullptr");
    //i like using nullptr even if in TS, and as a STRING! bite me
  }

  lockCurrentDevice() {
    lockScreen(this.app);
  }

  async exitByDeviceInfo(_deviceInfo_) {
    console.log("exit by dev info");
    this.sendGoeasyMsg(_deviceInfo_ + "#exitSiyuan#nullptr");
    //i like using nullptr even if in TS, and as a STRING! bite me
  }

  async exitCurrentDevice() {
    const exitTexts = ["退出应用", "Exit Application"];
    // console.log("try to lock"); //DBG
    var mainMenuButton = document.getElementById("barWorkspace");

    // main menu
    if (mainMenuButton) {
      mainMenuButton.click();
      await this.sleep(300);
    } else {
      console.log("siyuan_leave_to_lock: cant find the main menu button");
      return;
    }

    await this.sleep(100);

    function findTargetButton(elements) {
      var targetButton = null;
      elements.forEach(function (button) {
        var labelElement = button.querySelector('.b3-menu__label');
        if (labelElement && exitTexts.includes(labelElement.textContent.trim())) {
          targetButton = button;
        } else {
          var submenu = button.querySelector('.b3-menu__submenu');
          if (submenu) {
            // submenu exists 递归
            targetButton = findTargetButton(submenu.querySelectorAll('.b3-menu__item'));
          }
        }
      });
      return targetButton;
    }

    var targetButton = findTargetButton(document.querySelectorAll('.b3-menu__item'));

    if (targetButton) {
      targetButton.click();
    } else {
      console.error('siyuan_leave_to_lock: cant find the exit text');
    }

    await this.sleep(60000);


    client.exit({
      force: false
    });
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }



  async sendBarkNotification(title: string, body: string) {
    try {
      var barkApiBaseLink = this.settingUtils.get("barkApiBaseLink");
      var url = barkApiBaseLink + "/" + title + "/" + body;
      var response = await fetch(url);
      var result = await response.json();

      if (this.settingUtils.get("displayNoticeWhenBarkNotiSent")) {
        // showMessage("Bark notification sent: " + result.code);
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

        showMessage(this.i18n.onlineLocalmachineNoticeText);

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
    this.addIcons(`<symbol id="iconDevices" viewBox="0 0 512 512">
<path d="M472,232H424V120a24.028,24.028,0,0,0-24-24H40a24.028,24.028,0,0,0-24,24V366a24.028,24.028,0,0,0,24,24H212v50H152v32H304V440H244V390h92v58a24.027,24.027,0,0,0,24,24H472a24.027,24.027,0,0,0,24-24V256A24.027,24.027,0,0,0,472,232ZM336,256V358H48V128H392V232H360A24.027,24.027,0,0,0,336,256ZM464,440H368V264h96Z"></path>
</symbol>
`);
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

    try {
      this.settingUtils.load();
    } catch (error) {
      console.error(
        "Error loading settings storage, probably empty config json:",
        error,
      );
    }

    console.log("i am:" + this.fetchCurrentDeviceInfoAwait());
  }

  updateOnlineDeviceList() {
    this.fetchOnlineDevices((response) => {
      let deviceListHtml = "";
      response.content.members.forEach((member) => {
        // console.log("mem:", member.id);
        deviceListHtml +=
          member.id == this.fetchCurrentDeviceInfoAwait() //local machine or not
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
            this.sendGoeasyMsg("ALL#humanMessage#" + text);
            console.log("send human msg:", text);
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
        this.lockByDeviceInfo(deviceId);
        break;
      case "exit-siyuan":
        this.exitByDeviceInfo(deviceId);
        console.log("Exit device:", deviceId);
        break;
      case "send-human-msg":
        this.inputDialog({
          title: "发送消息",
          placeholder: "例如：别偷看我笔记！",
          width: this.isMobile ? "95vw" : "70vw",
          height: this.isMobile ? "95vw" : "30vw",
          confirm: (text: string) => {
            this.sendGoeasyMsg(deviceId + "#humanMessage#" + text);
            //TODO: more thigns here maybe
          },
        });
        console.log("send human msg:", deviceId);
        break;
    }
  }

  addLockDeviceListeners() {
    const lockButtons = document.querySelectorAll(".lock-siyuan");
    lockButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        const deviceId = (e.target as HTMLElement).getAttribute(
          "data-device-id",
        );
        if (deviceId) {
          this.lockByDeviceInfo(deviceId);
        }
      });
    });
  }

  onLayoutReady() {
    if (
      this.settingUtils.get("mainSwitch") &&
      this.settingUtils.get("goeasySwitch") &&
      this.settingUtils.get("goeasyToken")
    ) {
      this.goeasy = GoEasy.getInstance({
        host: "hangzhou.goeasy.io",
        appkey: this.settingUtils.get("goeasyToken"),
        modules: ["pubsub"],
      });

      this.initGoeasy();

      this.fetchOnlineDevices(() => { });

      this.addDock({
        config: {
          position: "LeftBottom",
          size: { width: 200, height: 0 },
          icon: "iconDevices",
          title: "Online Device Manager",
          hotkey: "⌥⌘M",
        },
        data: {
          text: "Online Device Manager",
        },
        type: DOCK_TYPE,
        resize() {
          console.log(DOCK_TYPE + " resize");
        },
        update() {
          console.log(DOCK_TYPE + " update");
        },
        init: (dock) => {
          dock.element.innerHTML = getDockHTML(this.isMobile, this); //the second arg is for pass the this to it.
          this.updateOnlineDeviceList();
          this.addRefreshButtonListener();
          this.addBroadcastButtonListener();
        },
        destroy() {
          console.log("destroy dock:", DOCK_TYPE);
        },
      });
    }
    // this.lockByDeviceInfo("123^abc");
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
            this.settingUtils.get("barkMsgSwitch") &&
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

  async onunload() {
    ///v cancel device event
    this.goeasy.pubsub.unsubscribePresence({
      channel: "online_devices",
      onSuccess: function () {
        //取消监听成功
        console.log("unsubscribe presence successfully.");
      },
      onFailed: function (error) {
        //监听失败
        console.log(
          "Failed to unsubscribe presence, code:" +
          error.code +
          ",error:" +
          error.content,
        );
      },
    });
    ///^

    ///v unsubscribe
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
    ///^

    ///v make offline
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
    ///^
  }

  uninstall() { }

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
    var current_device_info = current_device_uuid + "^" + current_device_name;

    return Promise.resolve(current_device_info.toString());
  }

  fetchCurrentDeviceInfoAwait() {
    var current_device_uuid = window.siyuan.config.system.id;
    var current_device_name = window.siyuan.config.system.name;
    var current_device_info = current_device_uuid + "^" + current_device_name;

    return current_device_info.toString();
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
        enableDeviceListArrayString,
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

        if (deviceInfo == current_device_info) {
          enableDeviceListArray.splice(i, 1);
        }
      }

      // reassemble list
      var enableDeviceListArrayString = enableDeviceListArray.join("\n");

      this.settingUtils.assignValue(
        "enableDeviceList",
        enableDeviceListArrayString,
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
      <div class="ft__breakword"><textarea class="b3-text-field fn__block" style="height: ${inputBoxHeight};" placeholder=${args?.placeholder ?? ""
        }>${args?.defaultText ?? ""}</textarea></div>
  </div>
  <div class="b3-dialog__action">
      <button class="b3-button b3-button--cancel">${window.siyuan.languages.cancel
        }</button><div class="fn__space"></div>
      <button class="b3-button b3-button--text" id="confirmDialogConfirmBtn">${window.siyuan.languages.confirm
        }</button>
  </div>`,
      width: args.width ?? "520px",
      height: args.height,
    });
    const target: HTMLTextAreaElement = dialog.element.querySelector(
      ".b3-dialog__content>div.ft__breakword>textarea",
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
