# 飞行计时到站提醒（声音 + 后台通知）— 设计文档

- 日期：2026-06-14
- 状态：已与用户确认，待评审
- 关联代码：`src/components/TimerPage.jsx`、`src/App.jsx`、`src/store.js`、`lib/operations.js`、`api/redeem.js`、`api/timers/*`、`lib/db.js`、`lib/auth.js`

## 1. 目标与背景

孩子兑换游戏时间会生成一个倒计时「飞行计时」。当计时到站（`endTime` 到达）时，要给出明确提醒，目标是**像闹钟一样可靠**：

- **前台**（App 打开且在屏幕上可见）：播放一段约 6.8 秒的「广州地铁关门铃声」到站音。
- **后台**（手机锁屏、孩子切到游戏/别的 App、浏览器标签被切到后台）：弹出**系统通知 + 振动 + 系统默认提示音**。

设备与部署环境：iPhone / iPad / 电脑，访问 Vercel 的 HTTPS 域名。其中 **iOS 仅在「添加到主屏幕」装成 PWA 后才能接收 Web 推送**（iOS 16.4+），普通 Safari 标签收不到。

## 2. 关键约束（已与用户确认接受）

1. **后台无法播放那段地铁音频。** Service Worker（负责后台推送）无法输出音频，只有可见网页能播声音；Web 推送在 iOS/安卓上都不允许自定义通知声音与时长。因此后台只能用「系统通知 + 振动 + 默认短提示音」，那段 5–8 秒的地铁音**仅前台可用**。
2. **iOS 必须装成 PWA** 才能订阅/接收推送。设计包含安装引导。
3. **Service Worker / 推送只在安全上下文（HTTPS）可用。** Vercel 部署满足；局域网 `http://192.168.*` 不满足，本方案不覆盖局域网 HTTP 部署。

## 3. 整体架构

```
[浏览器 / PWA]                              [Vercel Functions]              [Upstash]
 ├─ 前台到站音 (HTMLAudioElement)            /api/push/subscribe  ─────────►  Redis: timebank:push:subs
 ├─ Service Worker (push→系统通知)           /api/redeem (兑换后排程) ───────►  QStash: 在 endTime 回调
 └─ 订阅/通知权限/PWA 安装引导                /api/push/fire (QStash 验签→发推送) ◄── QStash 到点回调
```

- **前台**：App 打开且可见时，由 App 级 Hook 在 `endTime` 精确触发，播放本地音频文件。不依赖网络/权限。
- **后台**：兑换时服务端用 QStash 排一条「到 `endTime` 才投递」的消息，到点回调 `/api/push/fire`，该函数向所有已订阅设备发 Web Push，Service Worker 收到后弹系统通知。

## 4. 音频资源

- 用户提供文件：`/Users/huangyuzhao/Downloads/广州地铁关门铃声.mp3`（立体声、22050 Hz、约 6.77 秒、约 54 KB）。
- 实现时复制到仓库：`public/sounds/arrival.mp3`（用 ASCII 文件名，避免构建/URL 的中文编码问题）。
- 时长约 6.8 秒，已落在 5–10 秒目标区间内，**完整播放一遍即可，无需循环**。代码仍保留「未播完可手动停止」能力；若日后换成更短的文件，可改为 `loop` 直到约 8 秒。

## 5. 数据模型变更

- **Timer 对象新增 `scheduleId`**：QStash 消息 id。暂停时用它取消、继续时重排、清除时尽力取消。`pause` 后置空。
- **新增 Redis key `timebank:push:subs`**：推送订阅数组，元素为标准 PushSubscription（含 `endpoint` / `keys`）。按 `endpoint` 去重，支持多设备。发送时遇 410/404 视为失效并剔除。
- **`config` 新增 `notifyOnExpire`**（默认 `true`）：家长在 Admin 面板可全局开关后台通知。关闭时服务端跳过排程与发送（前台到站音不受此开关影响，由浏览器通知权限单独决定后台是否生效）。

## 6. 前台到站音（客户端，App 级）

- 新增 Hook `useTimerChime(timers)`，挂在 `src/App.jsx`（**不在 `TimerPage`**），这样切到任意 tab（任务/兑换/计时/记录）都能触发。
- 对每个未到站的计时器用 `setTimeout(endTime - now)` 精确触发；首个用户点击（任意点击）时解锁/`resume` AudioContext 与音频元素。
- 已响过的 `timerId` 记录在 ref + `localStorage`，避免组件重挂或定时器列表刷新导致重复播放。
- **回来补响**：监听 `visibilitychange → 可见`（及窗口 focus）。隐藏期间到站且未响过的计时器 → 补播一次到站音 + 顶部 toast「✈️ N 个飞行已到站」。
- **停止**：播放期间显示横幅「✈️ 已到站 · 点此停止」，点击立即停止音频；否则播完（约 6.8 秒）自动停止。

## 7. PWA + 权限/安装引导

- 新增 `public/manifest.webmanifest`（name、short_name、icons、`display: standalone`、theme/background color），`index.html` 引用。
- 新增 Service Worker（如 `public/sw.js`）：处理 `push` 事件 → `showNotification`；处理 `notificationclick` → 聚焦或打开 App 并切到「计时」tab。
- **「开启到站提醒」入口**（Admin 面板 + 首次轻提示横幅）：请求 `Notification` 权限 → `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: <VAPID 公钥> })` → POST `/api/push/subscribe`。
- **iOS 引导**：检测 iOS 且非 `standalone`（未安装）时，把「开启提醒」按钮替换为引导文案：分享 → 添加到主屏幕 → 从主屏幕打开后再开启提醒。只有在 `standalone` 下才显示订阅按钮。

## 8. 服务端：订阅 + 排程 + 发送

`lib/operations.js` 保持纯函数；所有副作用（QStash 排程/取消、发推送）放在 API handler 内。

- **`/api/push/subscribe`**（cookie 鉴权）：把订阅写入/更新到 `timebank:push:subs`（按 endpoint 去重）。
- **排程生命周期**：
  - **`redeem`**（`api/redeem.js`）：保存数据后，用 QStash 排一条 `Not-Before = endTime` 的消息，回调 `POST /api/push/fire?timerId=<id>`；把返回的消息 id 写回该 timer 的 `scheduleId` 后再次保存。
  - **`pause`**（`api/timers/[timerId].js`）：取消该 timer 的 QStash 消息（DELETE by scheduleId），清空 `scheduleId`。
  - **`resume`**：按新的 `endTime` 重新排程，写入新的 `scheduleId`。
  - **`clear`**（`api/timers/clear.js`）：对被清除且仍有 `scheduleId` 的计时器尽力取消其未触发消息。
- **`/api/push/fire`**（**QStash 签名验证**，非 cookie）：验签通过 → 读数据，校验该 timer 仍有效（存在、未暂停、确已到点）→ 向 `timebank:push:subs` 所有订阅用 `web-push`（VAPID）发送 → 剔除返回 410/404 的失效订阅。以 `tag = timerId` 保证幂等、同一计时器至多一条通知。
- **通知内容**：标题「✈️ 飞行到站！」，正文「『<label>』游戏时间结束啦」，飞机图标 + badge + 振动；桌面/安卓设 `requireInteraction: true`；`tag = timerId`；点击聚焦/打开 App 的「计时」tab。

## 9. 前置条件（实现前需具备）

- 生成 VAPID 密钥对（`npx web-push generate-vapid-keys`）→ 环境变量 `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`（公钥也要让前端拿到，用于 `subscribe`）。
- QStash：`QSTASH_TOKEN` / `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY`（Upstash 控制台获取）。
- 新增依赖：`web-push`、`@upstash/qstash`。
- 把音频文件放到 `public/sounds/arrival.mp3`。
- PWA 图标（192/512）放入 `public/`。

## 10. 边界与错误处理

- **前台与推送轻微重叠**：App 前台打开时，前台 Hook 会播到站音，同时系统可能也弹了一条推送通知（iOS 要求每条推送必须 `showNotification`）。用 `tag = timerId` 限制每个计时器至多一条通知，视为可接受的轻微冗余。
- **暂停后必须取消排程**，否则误报（已在 §8 处理）。
- **多计时器临近到站**：各自独立通知与到站音（前台会依次/叠加播放，可手动停止）。
- **失效订阅**：发送时遇 410/404 即从 `timebank:push:subs` 移除。
- **排程/推送失败不阻断兑换主流程**：QStash 排程失败仅记日志，兑换照常返回。
- **服务端时间为准**：QStash 按服务端计算的绝对 `endTime` 投递，避免客户端时钟漂移。

## 11. 测试

- **单元（vitest）**：
  - `pause` 取消排程、`resume` 重新排程、`clear` 取消（mock QStash 客户端，断言 cancel/schedule 调用）。
  - `/api/push/fire` 幂等与有效性校验（已暂停/已清除/未到点不发）。
  - 订阅去重与失效（410/404）剔除逻辑。
- **手动**：
  - iPhone 装 PWA → 兑换 1 分钟 → 锁屏 → 验证到点系统通知 + 振动。
  - 桌面/安卓 → 同上验证后台通知。
  - 前台：兑换短计时 → 停留在不同 tab → 验证到站音播放与「点此停止」；隐藏后再返回 → 验证补响。

## 12. 明确不做（YAGNI）

- 不做局域网 HTTP 部署下的推送（安全上下文不满足）。
- 不做后台自定义音频（平台不允许）。
- 不做按计时器单独的提醒开关；只有一个全局 `notifyOnExpire` + 各设备的浏览器通知权限。
- 不做多用户/多账号订阅隔离（本应用为单一家庭共享账号）。
