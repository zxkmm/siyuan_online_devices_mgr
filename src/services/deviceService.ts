import { exitSiYuan } from "siyuan";

export class DeviceService {
  private goEasyService: any;
  private lockScreenCallback: () => void; // this got to be callback bc ONLY this base plugin class can call lockScreen(this.app) somehow.

  constructor(goEasyService: any, lockScreenCallback: () => void) {
    this.goEasyService = goEasyService;
    this.lockScreenCallback = lockScreenCallback;
  }

  async lockDevice(deviceInfo: string) {
    console.log("lock by dev info");
    this.goEasyService.sendMessage(deviceInfo + "#lockScreen#nullptr");
  }

  lockCurrentDevice() {
    console.log("try lock this me");
    if (this.lockScreenCallback) {
      this.lockScreenCallback();
    }
  }

  async exitDevice(deviceInfo: string) {
    console.log("exit by dev info");
    this.goEasyService.sendMessage(deviceInfo + "#exitSiyuan#nullptr");
  }

  exitCurrentDevice() {
    exitSiYuan();
  }

  sendHumanMessage(deviceInfo: string, message: string) {
    this.goEasyService.sendMessage(deviceInfo + "#humanMessage#" + message);
  }

  sendToClipboard(deviceInfo: string, content: string) {
    this.goEasyService.sendMessage(deviceInfo + "#clipboard#" + content);
  }

  getCurrentDeviceInfo(): string {
    const currentDeviceUuid = window.siyuan.config.system.id;
    const currentDeviceName = window.siyuan.config.system.name;
    return `${currentDeviceUuid}^${currentDeviceName}`;
  }

  getDeviceDetails(): string {
    let details = "";
    details += "OS: " + window.siyuan.config.system.os;
    details += "Platform: " + window.siyuan.config.system.osPlatform;
    details += "Workspace: " + window.siyuan.config.system.workspaceDir;
    return details;
  }
}