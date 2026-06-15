import { exitSiYuan } from "siyuan";
import { performSync, setAccessAuthCode, request } from "../api";

/**
 * Bumped whenever the snippet runner logic changes. Echoed back in every snippet
 * run response so the requesting device can confirm the remote is running the
 * expected code (and detect a stale/deployed mismatch, e.g. on mobile).
 */
export const SNIPPET_RUNNER_VERSION = "async-iife-1";

/**
 * Rewrite a snippet so its final expression becomes the return value, REPL-like.
 * - If the snippet already contains a `return`, it is left untouched.
 * - Otherwise the last top-level expression statement (after the final `;`) is
 *   wrapped as `return (...)`.
 * This lets users write `request(...)`, `await request(...)`, or
 * `const x = ...; x` without an explicit `return`.
 */
export function transformSnippet(code: string): string {
  if (/\breturn\b/.test(code)) return code;
  const trimmed = code.replace(/\s+$/, "");
  const lastSemicolon = trimmed.lastIndexOf(";");
  if (lastSemicolon === -1) {
    // single expression, no semicolons
    return "return (" + trimmed + ")";
  }
  const head = trimmed.substring(0, lastSemicolon + 1);
  const tail = trimmed.substring(lastSemicolon + 1).trim();
  if (!tail) return head; // trailing semicolon, nothing to return
  return head + "\nreturn (" + tail + ");";
}

export class DeviceService {
  private goEasyService: any;
  private lockScreenCallback: () => void; // this got to be callback bc ONLY this base plugin class can call lockScreen(this.app) somehow.
  private sessionId: string;

  constructor(goEasyService: any, lockScreenCallback: () => void) {
    this.goEasyService = goEasyService;
    this.lockScreenCallback = lockScreenCallback;
    this.sessionId = Math.random().toString(36).substring(2, 6);
  }

  /* requestor */
  async lockDevice(deviceInfo: string) {
    console.log("lock by dev info");
    this.goEasyService.sendMessage(deviceInfo + "#lockScreen#nullptr");
  }

  /* responsor */
  async lockCurrentDevice() {
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

    /* requester */
  sendToClipboard(deviceInfo: string, content: string) {
    this.goEasyService.sendMessage(deviceInfo + "#clipboard#" + content);
  }

    /* requester */
  triggerSync(deviceInfo: string) {
    this.goEasyService.sendMessage(deviceInfo + "#triggerSync#nullptr");
  }

  /* requester */
  setAutoPassword(deviceInfo: string, password: string) {
    this.goEasyService.sendMessage(deviceInfo + "#setAutoPassword#" + password);
  }

  /* responsor */
  async syncCurrentDevice() {
    console.log("try sync this me");
    await performSync();
  }

  /* responsor */
  async setCurrentDeviceAutoPassword(password: string) {
    console.log("try set auto password this me");
    await setAccessAuthCode(password);
  }

  /* responsor — runs an arbitrary JS snippet on this device and returns its value.
     Implementation note: we deliberately do NOT use the AsyncFunction constructor
     (`Object.getPrototypeOf(async function(){}).constructor`). On some mobile
     WebViews that constructor is unavailable / returns the sync `Function`, which
     makes `await` invalid and throws "await is only valid in async functions".
     Instead we wrap the snippet in an async IIFE written as literal source
     (`(async (...) => { ... })()`), so the async-ness is plain syntax that every
     JS engine parses correctly. `request(apiPath, data)` calls the SiYuan kernel
     API; `window` and `console` are also in scope. */
  async runCodeOnCurrentDevice(code: string): Promise<any> {
    const transformed = transformSnippet(code);
    console.log(
      `[snippet-runner v${SNIPPET_RUNNER_VERSION}] executing:\n${transformed}`
    );
    // eslint-disable-next-line no-new-func
    const wrapper = new Function(
      "request",
      "window",
      "console",
      "return (async (request, window, console) => {\n" +
        transformed +
        "\n})(request, window, console);"
    );
    return await wrapper(request, window, console);
  }

  getCurrentDeviceInfo(): string {
    return `${window.siyuan.config.system.id}^${this.sessionId}`;
  }

  getCurrentDeviceData(): { deviceUuid: string, deviceName: string, sessionId: string } {
    const deviceUuid = window.siyuan.config.system.id;
    const deviceName = window.siyuan.config.system.name;
    return { deviceUuid, deviceName, sessionId: this.sessionId };
  }

  getDeviceDetails(): string {
    let details = "";
    details += "OS: " + window.siyuan.config.system.os;
    details += "Platform: " + window.siyuan.config.system.osPlatform;
    details += "Workspace: " + window.siyuan.config.system.workspaceDir;
    return details;
  }
}