import { showMessage } from "siyuan";

export class NotificationService {
  private barkApiBaseLink: string;
  private displayNoticeWhenBarkNotiSent: boolean;

  constructor(barkApiBaseLink: string, displayNoticeWhenBarkNotiSent: boolean) {
    this.barkApiBaseLink = barkApiBaseLink;
    this.displayNoticeWhenBarkNotiSent = displayNoticeWhenBarkNotiSent;
  }

  async sendBarkNotification(title: string, body: string): Promise<void> {
    try {
      const url = `${this.barkApiBaseLink}/${title}/${body}`;
      const response = await fetch(url);
      const result = await response.json();

      if (this.displayNoticeWhenBarkNotiSent) {
        console.log("Bark notification sent: " + result.code);
      }
    } catch (error) {
      console.error("Error sending bark notification:", error);
    }
  }

  async sendBarkDeviceOnlineNotification(
    deviceInfo: string,
    title: string,
    contentHeader: string,
    noticeText: string,
    alreadyNoticed: boolean
  ): Promise<boolean> {
    if (!alreadyNoticed) {
      try {
        const body = contentHeader + deviceInfo;
        await this.sendBarkNotification(title, body);
        showMessage(noticeText);
        return true;
      } catch (error) {
        console.error("Error sending bark device online notification:", error);
        return false;
      }
    }
    return alreadyNoticed;
  }

  showMessage(message: string) {
    showMessage(message);
  }
}