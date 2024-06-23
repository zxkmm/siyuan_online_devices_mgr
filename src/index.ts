import {
    Plugin,
    lockScreen
} from "siyuan";
import "@/index.scss";



import { SettingUtils } from "./libs/setting-utils";

const STORAGE_NAME = "menu-config";
var minLockDelay = 0.5; // minutes

export default class siyuan_leave_to_lock extends Plugin {

    private settingUtils: SettingUtils;

    async onload() {
        this.data[STORAGE_NAME] = { readonlyText: "Readonly" };

        this.settingUtils = new SettingUtils(this, STORAGE_NAME);

        this.settingUtils.load();

        this.settingUtils.addItem({
            key: "mainSwitch",
            value: false,
            type: "checkbox",
            title: this.i18n.mainSwitch,
            description: "",
        });

        this.settingUtils.addItem({
            key: "monitorVisibility",
            value: true,
            type: "checkbox",
            title: this.i18n.monitorVisibility,
            description: "",
        });

        this.settingUtils.addItem({
            key: "monitorMouse",
            value: true,
            type: "checkbox",
            title: this.i18n.monitorMouse,
            description: "",
        });

        this.settingUtils.addItem({
            key: "Slider",
            value: 50,
            type: "slider",
            title: this.i18n.timeout,
            description: this.i18n.timeUnit,
            slider: {
                min: 0.5,
                max: 120,
                step: 0.5,
            }
        });

        this.settingUtils.addItem({
            key: "visibilityDelay",
            value: 50,
            type: "slider",
            title: this.i18n.visibilityDelay,
            description: this.i18n.timeUnit,
            slider: {
                min: 0,
                max: 120,
                step: 0.1,
            }
        });

        this.settingUtils.addItem({
            key: "lockImplementation",
            value: 1,
            type: "select",
            title: this.i18n.lockImplementation,
            description: this.i18n.lockImplementationDesc,
            options: {
                1: "API",
                2: this.i18n.simulateClick,
            }
        });

        this.settingUtils.addItem({
            key: "simulateClickText",
            value: "锁屏",
            type: "textinput",
            title: this.i18n.simulateClickText,
            description: this.i18n.simulateClickTextDesc,
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
                }
            }
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
                }
            }
        });

        this.settingUtils.addItem({
            key: "hint",
            value: "",
            type: "hint",
            title: this.i18n.hintTitle,
            description: this.i18n.hintDesc,
        });


    }



    onLayoutReady() {
        this.loadData(STORAGE_NAME);
        this.settingUtils.load();

        const layoutReadyAsyncHandler = async () => {


            /*条件列表：
            当前设备真， 仅允许开关开，后半段为假 ：真||假： 执行
            当前设备真， 仅允许开关关，后半段为真 ：真||真： 执行
            当前设备假， 仅允许开关开，后半段为假 ：假||假： 不执行
            当前设备假， 仅允许开关关，后半段为真 ：假||真： 执行
            */


            try {

                const _visibilityDelay_ = this.settingUtils.get("visibilityDelay") * 1000 * 60;
                const _mouseOverDelay_ = this.settingUtils.get("Slider") * 1000 * 60;
                if ((await this.currentDeviceInList() || !this.settingUtils.get("onlyEnableListedDevices")) && this.settingUtils.get("mainSwitch")) {
                    // console.log("siyuan_leave_to_lock: device ifEnable condition entered"); //DBG

                    let timer;

                    document.addEventListener("visibilitychange", () => {
                        if (document.hidden) {
                            timer = setTimeout(() => {
                                if (this.settingUtils.get("mainSwitch") && this.settingUtils.get("monitorVisibility")) {


                                    if (this.settingUtils.get("lockImplementation") == 1) {
                                        console.log("condition,1,1"); //DBG
                                        this.lock_screen_with_api();
                                    } else if (this.settingUtils.get("lockImplementation") == 2) {
                                        console.log("condition,1,2"); //DBG
                                        this.lock_screen_with_simulate_click();
                                    } else {
                                        console.log("condition,1,3"); //DBG
                                        this.lock_screen_with_api();
                                    }

                                    this.sleep(1000);
                                }
                            }, _visibilityDelay_);
                        } else {
                            clearTimeout(timer);
                        }
                    });

                    document.addEventListener("mouseout", () => {
                        timer = setTimeout(() => {
                            if (this.settingUtils.get("mainSwitch") && this.settingUtils.get("monitorMouse")) {
                                if (this.settingUtils.get("lockImplementation") == 1) {
                                    this.lock_screen_with_api();
                                    // console.log("condition,2,1"); //DBG
                                } else if (this.settingUtils.get("lockImplementation") == 2) {
                                    // console.log("condition,2,2"); //DBG
                                    this.lock_screen_with_simulate_click();
                                } else {
                                    this.lock_screen_with_api();
                                    // console.log("condition,2,3"); //DBG
                                }
                                this.sleep(1000);
                            }
                        }, _mouseOverDelay_);
                    });

                    document.addEventListener("mouseover", () => {
                        clearTimeout(timer);
                    });
                }
            } catch (error) {
                console.error("sy_leave_to_lock: failed loading device ifEnable condition", error);
            }
        };

        layoutReadyAsyncHandler();
    }


    lock_screen_with_api() {
        lockScreen(this.app);
    }



    async lock_screen_with_simulate_click() {
        var user_defined_simulate_click_text = this.settingUtils.get("simulateClickText");
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
                if (labelElement && labelElement.textContent.trim() == user_defined_simulate_click_text) {
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
            console.error('siyuan_leave_to_lock: cant find the text you defined');
        }
    }




    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }



    async onunload() {
        await this.settingUtils.save();
        // window.location.reload();
    }


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
            // await!!!!!
            var current_device_info = await this.fetchCurrentDeviceInfo();

            var enableDeviceList = this.settingUtils.get("enableDeviceList");
            var enableDeviceListArray = enableDeviceList.split("\n");
            var enableDeviceListArrayLength = enableDeviceListArray.length;
            var enableDeviceListArrayLast = enableDeviceListArray[enableDeviceListArrayLength - 1];

            // remove empty line
            if (enableDeviceListArrayLast === "") {
                enableDeviceListArray.pop();
            }

            enableDeviceListArray.push(current_device_info);

            var enableDeviceListArrayString = enableDeviceListArray.join("\n");

            this.settingUtils.assignValue("enableDeviceList", enableDeviceListArrayString);
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

            this.settingUtils.assignValue("enableDeviceList", enableDeviceListArrayString);
            this.settingUtils.save();
        } catch (error) {
            console.error("Error removing current device from list:", error);
        }

    }





}
