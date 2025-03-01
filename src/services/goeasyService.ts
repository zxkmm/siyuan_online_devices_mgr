import GoEasy from "goeasy-lite";

export class GoEasyService {
  private goeasy: any;
  private handleMessage: (message: any, deviceInfo: string) => void;
  private updateDeviceListFromPresence: (presenceEvent: any) => void;
  
  constructor(
    apiToken: string, 
    handleMessageCallback: (message: any, deviceInfo: string) => void,
    updateDeviceListCallback: (presenceEvent: any) => void
  ) {
    this.handleMessage = handleMessageCallback;
    this.updateDeviceListFromPresence = updateDeviceListCallback;
    
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

  sendMessage(message: string) {
    this.goeasy.pubsub.publish({
      channel: "online_devices",
      message: message,
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