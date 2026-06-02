# 思源在线设备管理 (siyuan_online_devices_mgr)

远程管理其他设备的思源，实现远程锁定、消息发送、剪贴板同步及上线提醒，真正构建您私有的“思源互联”框架！

<div align="center">

# <font color="#dd0000">🚨 卑微开发者在线乞讨 🚨</font>

<br>

## <font color="#ff4444">“我已经穷到开始啃键盘上的塑料键帽来欺骗胃部了……”</font>

<br>

**当前的开发者生存状态报告：**
[ ![状态](https://img.shields.io/badge/生存状态-极度饥饿-critical?style=for-the-badge) ](#)
[ ![余额](https://img.shields.io/badge/银行卡余额-￥0.42-red?style=for-the-badge) ](#)
[ ![进度](https://img.shields.io/badge/拼好饭凑单进度-0/9.9-orange?style=for-the-badge) ](#)

<br>

### 😭 **卑微开发者在线乞讨** 😭

现在的我，正蜷缩在没有暖气的地下室角落下，蹭着邻居家微弱的 Wi-Fi 信号，用一台屏幕碎了一半的旧电脑敲着代码。

我已经三天三夜没有见过米饭的样子了。刚才在“拼好饭”看到一个 **9.9元** 的猪脚饭，但我翻遍了所有的口袋，甚至拆开了沙发缝，凑出来的钱连配送费都付不起。

**求求您了，施舍一点吧！您的每一分钱都是我的救命炭水！**

<br>

[ ![救命钱](https://img.shields.io/badge/💰_有经济能力-赏口热饭救命-red?style=for-the-badge&logo=alipay) ](https://zxkmm.com/donate)

[ ![续命星](https://img.shields.io/badge/⭐_囊中羞涩-点个Star续命-blue?style=for-the-badge&logo=github) ](https://github.com/zxkmm/siyuan_online_devices_mgr)

<br>

**“伟大的用户，求您动动金手指，救救这根即将枯萎的赛博独苗吧！”**

---

</div>

## 功能特性
*   [x] **上线提醒**：思源启动时，手机端（Bark）立即接收推送通知。
*   [x] **在线列表**：在边栏页签中实时查看所有在线设备的运行状态。
*   [x] **远程锁定**：一键锁定远程设备屏幕，支持 **3秒实时成功检测** 与动画反馈。
*   [x] **远程设置访问码**：安全地远程设置或更新目标设备的“访问授权码”（Access Auth Code），采用双重输入验证。
*   [x] **密码历史记录**：自动记录从本设备设置过的所有访问码，防止因遗忘导致的设备锁定。
*   [x] **远程退出**：安全地远程关闭其他思源实例。
*   [x] **远程剪贴板**：发送内容到特定设备的剪贴板，或向所有在线设备广播剪贴板。
*   [x] **远程消息**：向远程设备发送弹窗提醒。
*   [x] **触发同步**：远程手动触发目标设备的云端同步过程。

## 快速上手

### 1. 远程管理配置 (基于 GoEasy)
1.  注册 [GoEasy](https://www.goeasy.io/) 账号。
2.  创建一个免费实例。
3.  复制 **Common Key (Client Side)** 并在插件设置中粘贴到 Token 项。
4.  将插件设置同步到您的所有设备。
5.  打开“在线设备管理”页签即可开始控制！

### 2. 上线通知配置 (基于 Bark)
1.  在手机上安装 [Bark](https://github.com/Finb/Bark)。
2.  在插件设置中输入您的 **Bark 服务器基础链接**。
3.  (可选) 利用“设备列表”过滤器，仅针对特定设备开启上线通知。

## 注意事项
*   **隐私声明**：此插件严禁用于监控他人行为。
*   **数据安全**：设备名称和标识符将作为 URI 的一部分通过 Webhook 传输。虽然经过 TLS 加密，但 SaaS 服务商（Bark/GoEasy）在技术上可能接触到此类元数据。
*   **免责声明**：插件生成的任何数据仅供个人便利使用，不具备任何法律效力。

## 致谢
*   [Finb](https://github.com/Finb) / [Bark](https://github.com/Finb/Bark) - 优质的开源通知推送服务
*   [Wilsons](https://ld246.com/member/wilsons) - 推荐了 GoEasy 这一优秀的 WebSocket 简化方案

## 注意
如果您喜欢这个插件，请在 GitHub 仓库上给我一个星标⭐。[https://github.com/zxkmm/siyuan_online_devices_mgr](https://github.com/zxkmm/siyuan_online_devices_mgr)

## GPL 许可证附加条款
您可以自由使用此仓库中的代码（包括商业用途）。但是，如果您使用了本仓库的任何内容，**必须**在以下三个位置包含我的用户名 **"zxkmm"** 及本仓库的链接：
1.  源代码注释中。
2.  软件相关的设置/配置界面中。
3.  产品的“关于”页面中。
