import SiyuanOnlineDeviceManager from ".";

export function getDockHTML(
  _isMobile_: boolean,
  _instance_: SiyuanOnlineDeviceManager,
): string {
  const styles = `
    <style>
      .device-list {
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .device-item {
        border: 1px solid var(--b3-theme-background-light);
        border-radius: 5px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .device-info {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }
      .device-name, .device-uuid {
        flex: 1 1 100%;
        word-break: break-all;
      }
      .device-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
      }
      .device-action {
        flex: 1 1 auto;
        padding: 5px 10px;
        // background-color: #f0f0f0;
        border: none;
        border-radius: 3px;
        cursor: pointer;
        text-align: center;
        min-width: 60px;
      }
      // .device-action:hover {
      //   background-color: #e0e0e0;
      // }
      @media (min-width: 5000px) { //i dont have a 4k monitor but i guess this is a valid value???
        .device-name, .device-uuid {
          flex: 1 1 40%;
        }
      }
      .wide-button {
        width: 100%;
        padding: 5px 10px;
        // background-color: #f0f0f0;
        border-radius: 3px;
        cursor: pointer;
        // font-size: 18px;
        margin-bottom: 10px;
      }


      .dock-content {
        display: flex;
        flex-direction: column;
        height: 100%;
        padding: 10px;
      }

      .begging-info {
        background-color: var(--b3-theme-background-light);
        // border-radius: 5px;
        padding: 10px;
        margin-top: 10px;
        // margin-bottom: 10px;
        // margin-left: 10px;
        // margin-right: 10px;
        text-align: center;
        font-size: 14px;
      }
    </style>
  `;

  const content = `
    <div class="dock-content">
      <button id="refreshDeviceList" class="wide-button b3-button b3-button--outline fn__flex-center">${_instance_.i18n.textRefresh}</button>
      <button id="sendBroadcast" class="wide-button b3-button b3-button--outline fn__flex-center">${_instance_.i18n.textSendBroadcast}</button>
      <button id="sendBroadcastClipboard" class="wide-button b3-button b3-button--outline fn__flex-center">${_instance_.i18n.textSendBroadcastClipboard}</button>

      <div class="device-list" id="onlineDeviceList">
        Loading...
      </div>
    </div>
  `;

  const beggingInfo = `
    <div class="begging-info">
      ${_instance_.i18n.beggingInfoText}
      <a href="https://github.com/zxkmm/siyuan_online_devices_mgr" target="_blank">GitHub</a>
    </div>
  `;

  const shouldShowBeggingInfo = Math.random() < 0.2;

  if (_isMobile_) {
    return `
      <div class="fn__flex-column" style="height: 100%;">
        <div class="toolbar toolbar--border toolbar--dark">
          <svg class="toolbar__icon"><use xlink:href="#iconDevices"></use></svg>
          <div class="toolbar__text">${_instance_.i18n.name}</div>
        </div>
        ${styles}
        <div class="fn__flex-1 plugin-sample__custom-dock">
          ${content}
        </div>
        ${shouldShowBeggingInfo ? beggingInfo : ""}
      </div>
    `;
  } else {
    return `
      <div class="fn__flex-column" style="height: 100%;">
        <div class="block__icons">
          <div class="block__logo">
            <svg class="block__logoicon"><use xlink:href="#iconDevices"></use></svg>
            ${_instance_.i18n.name}
          </div>
          <span class="fn__flex-1 fn__space"></span>
          <span data-type="min" class="block__icon b3-tooltips b3-tooltips__sw" aria-label="Min ⌘W">
            <svg class="block__logoicon"><use xlink:href="#iconMin"></use></svg>
          </span>
        </div>
        ${styles}
        <div class="fn__flex-1 plugin-sample__custom-dock">
          ${content}
        </div>
        ${shouldShowBeggingInfo ? beggingInfo : ""}
      </div>
    `;
  }
}
