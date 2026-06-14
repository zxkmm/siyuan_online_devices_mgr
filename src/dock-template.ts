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

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .loading-icon {
        animation: spin 2s linear infinite;
      }
      .device-action.locking {
        pointer-events: none;
        opacity: 0.6;
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

      .snippet-manager-empty {
        opacity: 0.6;
        text-align: center;
        padding: 16px;
      }
      .snippet-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .snippet-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        border: 1px solid var(--b3-theme-background-light);
        border-radius: 4px;
      }
      .snippet-row .snippet-name {
        flex: 1 1 auto;
        word-break: break-all;
        font-weight: bold;
      }
      .snippet-row .snippet-actions {
        display: flex;
        gap: 4px;
        flex: 0 0 auto;
      }
      .snippet-picker-item {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 4px;
        width: 100%;
        text-align: left;
        padding: 10px 12px;
        min-height: 96px;
        overflow: hidden;
        /* backdrop color for the title strip; tracks the item's own background
           so it stays in sync on hover instead of looking like a hole */
        --snippet-backdrop: var(--b3-theme-background);
      }
      .snippet-picker-item:hover {
        --snippet-backdrop: var(--b3-theme-background-light);
      }
      .snippet-picker-item .snippet-picker-name {
        position: relative;
        z-index: 2;
        font-weight: bold;
        font-size: 18px;
        /* fade a backdrop in behind the title so the bold text stays readable
           over the code preview underneath */
        background: linear-gradient(
          to bottom,
          color-mix(in srgb, var(--snippet-backdrop) 0%, transparent) 0%,
          color-mix(in srgb, var(--snippet-backdrop) 55%, transparent) 45%,
          color-mix(in srgb, var(--snippet-backdrop) 72%, transparent) 100%
        );
        padding: 2px 0 4px;
      }
      .snippet-picker-item .snippet-picker-preview {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        bottom: 0;
        z-index: 1;
        opacity: 0.42;
        font-family: monospace;
        font-size: 12px;
        line-height: 1.45;
        white-space: pre-wrap;
        word-break: break-all;
        padding: 14px 12px 10px;
        pointer-events: none;
        user-select: none;
        /* fade the code out at top (under the title) and bottom so it never
           looks hard-clipped, no overflow-hidden text cutoff needed */
        -webkit-mask-image: linear-gradient(
          to bottom,
          transparent 0%,
          rgba(0, 0, 0, 0.55) 18%,
          #000 38%,
          #000 62%,
          rgba(0, 0, 0, 0.55) 82%,
          transparent 100%
        );
        mask-image: linear-gradient(
          to bottom,
          transparent 0%,
          rgba(0, 0, 0, 0.55) 18%,
          #000 38%,
          #000 62%,
          rgba(0, 0, 0, 0.55) 82%,
          transparent 100%
        );
      }
    </style>
  `;

  const content = `
    <div class="dock-content">
      <button id="refreshDeviceList" class="wide-button b3-button b3-button--outline fn__flex-center"><svg class="svg"><use xlink:href="#iconRefresh"></use></svg> ${_instance_.i18n.textRefresh}</button>
      <button id="sendBroadcast" class="wide-button b3-button b3-button--outline fn__flex-center"><svg class="svg"><use xlink:href="#iconEmail"></use></svg> ${_instance_.i18n.textSendBroadcast}</button>
      <button id="sendBroadcastClipboard" class="wide-button b3-button b3-button--outline fn__flex-center"><svg class="svg"><use xlink:href="#iconPaste"></use></svg> ${_instance_.i18n.textSendBroadcastClipboard}</button>
      <button id="manageSnippets" class="wide-button b3-button b3-button--outline fn__flex-center"><svg class="svg"><use xlink:href="#iconTerminal"></use></svg> ${_instance_.i18n.textManageSnippets}</button>
      <button id="viewDisclaimer" class="wide-button b3-button b3-button--outline fn__flex-center"><svg class="svg"><use xlink:href="#iconInfo"></use></svg> ${_instance_.i18n.viewDisclaimerLabel}</button>

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
