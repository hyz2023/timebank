# 到站提醒优化（已读/未读模型）— 设计文档

- 日期：2026-06-14
- 状态：已与用户确认，待评审
- 关联代码：`src/hooks/useTimerChime.js`、`src/utils/timerChime.js`、`src/App.jsx`
- 前序设计：`docs/superpowers/specs/2026-06-14-flight-timer-arrival-alert-design.md`

## 1. 背景与问题

前台到站提醒（`useTimerChime`）当前有两个体验问题：

1. **进入页面会一次性播报历史 backlog**：首次加载时 `localStorage` 的已响集合为空，`pickNewlyExpired` 把**所有历史已到站**的计时器都当成"刚到站"，于是横幅显示「✈️ 70 个飞行已到站」并播一次声音。用户只想知道**最近一个**到站的。
2. **未明确的已读/未读语义**：用户希望——已经被点掉/已读的提醒，重进页面不再播报；但若某计时器是在**后台或隐藏期间到点**、且**仍未读**，回到页面时**应当补响一次**。

## 2. 目标

- 进入页面时**不**播报历史 backlog（静默）。
- 实时（前台可见）到站时播报。
- 在后台/隐藏期间到点的**未读**计时器，回到前台时**补响一次**。
- 每次只播报**最近一个**到站项（带名字），声音播一遍。
- 已读（响过/补响过/被点掉）状态持久化，重进页面不重播。

## 3. 已读/未读模型

持久化一个**已读集合** `seenRef`（沿用 `localStorage` key `timebank-chimed-timers`）。规则：**一个计时器进入已读集合后永不再响**。

- **未读** = "已到站（`endTime <= now` 且未暂停）"且**不在**已读集合里。
- **一次性消化历史 backlog**：新增持久化标记 `timebank-chime-initialized`。**首次加载**（标记不存在）时，把当前所有"已到站"的计时器 id **直接加入已读集合（静默：不播声、不弹横幅）**，然后写上标记。这把历史 backlog 一次性"读掉"。
  - 任何客户端（含新设备 / 清过缓存）首次加载都会这样静默消化当时的 backlog —— 符合"进入页面要安静"。

## 4. 触发与播报：`announceArrivals()`

统一一个函数 `announceArrivals()`：

```
若 document.visibilityState !== 'visible' → 直接返回（隐藏时不响，保持未读）
ids = pickNewlyExpired(timers, seenRef, now)   // 未读且已到站
若 ids 为空 → 返回
把 ids 全部加入 seenRef 并持久化               // 其余未读项静默标记已读
latest = mostRecentArrived(timers, ids)        // 按 endTime 取最新到站的一个
setLastArrived({ id, label })                  // 横幅只显示这一个
playArrivalSound()                             // 声音播一遍
```

调用时机：
- **前台实时到站**：每个未来计时器在 `endTime` 处的 `setTimeout` 触发时调用（可见→当场响；隐藏→`announceArrivals` 直接返回，保持未读，留待补响）。
- **回到前台**：`visibilitychange`→可见、`window` 的 `focus`。补响离开期间到站的未读项。
- **加载时**：挂载后调用一次（非首次加载时，补响"关页/离开期间"到站的未读项；首次加载时 backlog 已被静默消化，故无声）。
- **计时列表变化**：重建未来计时器的 `setTimeout`；并调用 `announceArrivals()`（可见才响）。新兑换的计时器是未来项，不会在此刻被播报。

历史 backlog 已在已读集合中，上述时机都不会再碰它们。

## 5. 两点诉求的满足

- **只提示最近一个**：`announceArrivals` 永远只 `setLastArrived` 一个（最近到站项），声音一遍；一次多个未读到站时，其余静默标记已读。横幅文案：「✈️『<label>』到站啦 · 点此停止」。
- **点掉后不重播**：响过/补响过即入已读集合并持久化；`dismiss()` 只关横幅、停声音，**不**改已读集合 → 重进不再响。

## 6. 状态与数据

- `seenRef`（`useRef<Set<string>>`，持久化到 `localStorage['timebank-chimed-timers']`）：已读 id 集合。
- 初始化标记 `localStorage['timebank-chime-initialized'] = '1'`：backlog 是否已静默消化。
- `lastArrived`（`useState<{id, label} | null>`）：当前横幅要显示的最近到站项；`dismiss` 置 null。
- `timeoutsRef`（`useRef<Map<id, handle>>`）：每个未来计时器的 `setTimeout` 句柄，列表变化时重建、卸载时清理。
- **集合修剪**：列表变化时，把已不在 `timers` 中的 id 从 `seenRef` 移除（避免无限增长），并持久化。

## 7. 纯函数（可单测）

- `pickNewlyExpired(timers, seen, now)`（已有）：返回"未暂停、`endTime != null`、`endTime <= now`、不在 `seen`"的 id 列表。继续复用，仅改变用途（静默 seed / 播报取数）。
- `mostRecentArrived(timers, ids)`（新增，纯函数）：在 id ∈ `ids` 的计时器中，返回 `endTime` 最大的那个（`{ id, label }`）；`ids` 为空返回 `null`。

## 8. 影响范围

- 改写 `src/hooks/useTimerChime.js`：用 `seenRef` + 初始化标记 + `announceArrivals`（可见门控、最近一个、声音一遍），从 `setTimeout` / `visibilitychange` / `focus` / 挂载 / 列表变化触发；返回 `{ lastArrived, dismiss }`（取代 `{ arrivedCount, dismiss }`）。
- 改 `src/App.jsx`：横幅用 `lastArrived`（显示名字）取代 `arrivedCount` 计数；`dismiss` 不变。
- 改 `src/utils/timerChime.js`：保留 `pickNewlyExpired`，新增 `mostRecentArrived`。
- **后端 / PWA / Service Worker / 推送：不动。**

## 9. 边界与错误处理

- 隐藏期间 `setTimeout` 迟发：`announceArrivals` 因不可见直接返回，不会"迟到乱响"；回到前台再补。
- 一次多个未读到站：只弹最近一个，其余静默入已读（符合"只提示最近一个"）。
- `localStorage` 不可用（隐私模式等）：读写包 try/catch，退化为内存集合（当次会话有效），不报错。
- 计时器暂停（`endTime=null`）：`pickNewlyExpired` already 过滤，不计入到站。
- 清除已到站后：相关 id 从 `seenRef` 修剪。

## 10. 测试

- 单测（vitest）：
  - `pickNewlyExpired`（已有）。
  - `mostRecentArrived`：多个 id 取 `endTime` 最大；空返回 null；忽略不在 ids 中的。
- 手动：
  1. 兑换 1 分钟计时停在页面 → 到点响一次 + 单个横幅（带名字）。
  2. 兑换后切到别的 App，到点后切回 → 补响一次（最近一个）。
  3. 历史一堆已到站 → 进入页面静音、无横幅。
  4. 响过/点掉后重进页面 → 不重播。

## 11. 明确不做（YAGNI）

- 不做"最近 N 分钟"时间窗启发式（用已读/未读 + 一次性 backlog 消化来区分，更贴合用户语义）。
- 不改后台推送（系统通知仍在 `endTime` 由 QStash 触发，与前台补响相互独立）。
- 不做多条到站的合并列表 UI（只弹最近一个）。
