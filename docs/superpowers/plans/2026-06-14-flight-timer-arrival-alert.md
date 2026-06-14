# 飞行计时到站提醒 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 飞行计时到站时，前台播放用户提供的「广州地铁关门铃声」，后台（锁屏/切走）通过系统通知 + 振动提醒。

**Architecture:** 前台用 App 级 Hook 在 `endTime` 精确 `setTimeout` 触发本地音频；后台用 Upstash QStash 在 `endTime` 回调一个受共享密钥保护的 `/api/push/fire`，由 `web-push`（VAPID）向所有已订阅设备发 Web Push，Service Worker 弹系统通知。iOS 需「添加到主屏幕」装成 PWA 后才能订阅。

**Tech Stack:** React 19 + Vite、Zustand、Vercel Functions、Upstash Redis、Upstash QStash、`web-push`、Web Push API / Service Worker / PWA。

---

## 与 spec 的一处偏差（务必先读）

spec §8 写的是「QStash 签名验证」。本计划改用**共享密钥 token**鉴权 `/api/push/fire`：

- 原因：QStash 的 `Receiver.verify` 需要**原始请求体**，而 Vercel 朴素 Node 函数会自动解析 body、拿原始体不稳定，易出错。
- 做法：服务端排程时通过 QStash 的转发头把只有服务端与 QStash 知道的密钥发给回调端（`publishJSON({ headers: { 'x-fire-token': PUSH_FIRE_SECRET } })`，QStash 自动加 `Upstash-Forward-` 前缀转发到目标），fire 端校验请求头 `x-fire-token`。密钥**不进 URL**（避免出现在日志/QStash 消息记录里），也不暴露给前端，最坏后果仅一条误报通知，实现稳健。
- 因此**不需要** `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY`。

`notBefore` 单位：QStash TS SDK 的 `publishJSON({ notBefore })` 取 **Unix 秒**（非毫秒）。

`config.notifyOnExpire` 向后兼容：旧数据没有该字段时按「开启」处理（仅 `=== false` 才关闭）。

---

## 文件结构

**新增（服务端 / 纯逻辑）**
- `lib/push.js` — 纯函数：订阅去重、失效剔除、通知载荷、`shouldFire`
- `lib/qstash.js` — QStash 排程/取消封装 + 纯 helper（`toNotBeforeSeconds`/`buildFireUrl`/`resolveBaseUrl`/`qstashEnabled`）
- `lib/webpush.js` — `web-push` 发送封装（`sendToAll` 可注入 sender）
- `lib/pushstore.js` — Redis 读写订阅（`timebank:push:subs`）
- `api/push/public-key.js` — 返回 VAPID 公钥（cookie 鉴权）
- `api/push/subscribe.js` — 保存订阅（cookie 鉴权）
- `api/push/fire.js` — QStash 到点回调（token 鉴权）发推送

**新增（客户端 / PWA）**
- `src/utils/timerChime.js` — 纯函数：`pickNewlyExpired`
- `src/utils/arrivalSound.js` — 到站音频元素 play/stop/unlock
- `src/utils/push-client.js` — 注册 SW、订阅、环境检测
- `src/hooks/useTimerChime.js` — 前台到站音 Hook
- `public/sw.js` — Service Worker（push / notificationclick）
- `public/manifest.webmanifest` — PWA manifest
- `public/sounds/arrival.mp3` — 用户提供的广州地铁关门铃声
- `public/icons/icon.svg` + 生成的 `icon-192.png` / `icon-512.png` / `apple-touch-icon-180.png`
- `scripts/gen-icons.mjs` — 由 SVG 生成 PNG 图标

**修改**
- `lib/operations.js` — 新增 `setTimerSchedule`；`getDefaultData` config 加 `notifyOnExpire: true`
- `api/redeem.js` — 兑换后排程，写回 `scheduleId`
- `api/timers/[timerId].js` — 暂停取消排程、继续重排
- `api/timers/clear.js` — 清除时取消对应排程
- `src/store.js` — 新增 `enableNotifications` 与 `setNotifyOnExpire` action
- `src/App.jsx` — 挂载 `useTimerChime`、到站横幅、`?tab=timer` 深链
- `src/main.jsx` — 注册 Service Worker
- `src/components/AdminPanel.jsx` — 「到站提醒」设置区
- `index.html` — manifest / theme-color / apple-touch-icon
- `package.json` — 依赖 `web-push`、`@upstash/qstash`；devDep `sharp`
- `.env.example` — 记录新环境变量

---

## Phase 0 — 依赖与资源

### Task 1: 安装依赖并登记环境变量

**Files:**
- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: 安装依赖**

Run:
```bash
npm install web-push @upstash/qstash
npm install -D sharp
```
Expected: `package.json` 的 dependencies 出现 `web-push`、`@upstash/qstash`，devDependencies 出现 `sharp`，安装无报错。

- [ ] **Step 2: 在 `.env.example` 追加新变量说明**

把以下内容追加到 `.env.example` 末尾：
```bash
# === Web Push（到站提醒）===
# 用 `npx web-push generate-vapid-keys` 生成
VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
VAPID_SUBJECT="mailto:esther@digiplus.com.ph"

# === QStash（到点定时回调）===
QSTASH_TOKEN=""

# fire 回调共享密钥（任意长随机串，如 `openssl rand -hex 32`）
PUSH_FIRE_SECRET=""

# QStash 回调用的公开站点地址（生产域名，含协议）。Vercel 上未设时回退到 https://$VERCEL_URL
PUBLIC_BASE_URL="https://timebank.vercel.app"
```

- [ ] **Step 3: 提交**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: 到站提醒依赖与环境变量 (web-push/qstash/sharp)"
```

---

### Task 2: 放入到站音频文件

**Files:**
- Create: `public/sounds/arrival.mp3`

- [ ] **Step 1: 复制用户提供的 MP3 到仓库（ASCII 文件名）**

Run:
```bash
mkdir -p public/sounds
cp "/Users/huangyuzhao/Downloads/广州地铁关门铃声.mp3" public/sounds/arrival.mp3
ls -la public/sounds/arrival.mp3
```
Expected: `public/sounds/arrival.mp3` 存在，约 54 KB。

- [ ] **Step 2: 提交**

```bash
git add public/sounds/arrival.mp3
git commit -m "feat: 到站音频资源 (广州地铁关门铃声)"
```

---

## Phase 1 — 服务端纯逻辑（TDD）

### Task 3: `lib/push.js` — 订阅去重与失效剔除

**Files:**
- Create: `lib/push.js`
- Test: `tests/push.test.js`

- [ ] **Step 1: 写失败测试**

`tests/push.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { upsertSubscription, removeEndpoints } from '../lib/push.js'

describe('upsertSubscription', () => {
  it('新 endpoint 追加', () => {
    const out = upsertSubscription([], { endpoint: 'a', keys: {} })
    expect(out).toHaveLength(1)
    expect(out[0].endpoint).toBe('a')
  })
  it('同 endpoint 覆盖而非重复', () => {
    const subs = [{ endpoint: 'a', keys: { p: 1 } }]
    const out = upsertSubscription(subs, { endpoint: 'a', keys: { p: 2 } })
    expect(out).toHaveLength(1)
    expect(out[0].keys.p).toBe(2)
  })
  it('非数组输入按空数组处理', () => {
    expect(upsertSubscription(undefined, { endpoint: 'a' })).toHaveLength(1)
  })
})

describe('removeEndpoints', () => {
  it('移除指定 endpoint', () => {
    const subs = [{ endpoint: 'a' }, { endpoint: 'b' }, { endpoint: 'c' }]
    const out = removeEndpoints(subs, ['b', 'c'])
    expect(out.map((s) => s.endpoint)).toEqual(['a'])
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run tests/push.test.js`
Expected: FAIL（`lib/push.js` 不存在 / 函数未定义）

- [ ] **Step 3: 实现**

`lib/push.js`:
```js
// 推送相关纯函数

// 按 endpoint 去重地加入/更新一条订阅
export function upsertSubscription(subs, sub) {
  const list = Array.isArray(subs) ? subs : []
  return [...list.filter((s) => s.endpoint !== sub.endpoint), sub]
}

// 从订阅列表移除指定 endpoint（失效订阅）
export function removeEndpoints(subs, endpoints) {
  const dead = new Set(endpoints)
  return (Array.isArray(subs) ? subs : []).filter((s) => !dead.has(s.endpoint))
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run tests/push.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/push.js tests/push.test.js
git commit -m "feat: 推送订阅去重与失效剔除纯函数"
```

---

### Task 4: `lib/push.js` — 通知载荷与 shouldFire

**Files:**
- Modify: `lib/push.js`
- Test: `tests/push.test.js`

- [ ] **Step 1: 追加失败测试**

在 `tests/push.test.js` 顶部 import 改为：
```js
import { upsertSubscription, removeEndpoints, buildPushPayload, shouldFire } from '../lib/push.js'
```
在文件末尾追加：
```js
describe('buildPushPayload', () => {
  it('含标题、标签与计时器名', () => {
    const p = buildPushPayload({ id: 'timer_1', label: '短途飞行' })
    expect(p.title).toContain('到站')
    expect(p.tag).toBe('timer_1')
    expect(p.body).toContain('短途飞行')
    expect(p.url).toBe('/?tab=timer')
  })
})

describe('shouldFire', () => {
  const data = (timers, cfg) => ({ timers, config: { notifyOnExpire: true, ...cfg } })
  it('到点且未暂停 → true', () => {
    expect(shouldFire(data([{ id: 't', endTime: 1000 }]), 't', 1000)).toBe(true)
  })
  it('计时器不存在（已清除）→ false', () => {
    expect(shouldFire(data([]), 't', 1000)).toBe(false)
  })
  it('已暂停 → false', () => {
    expect(shouldFire(data([{ id: 't', endTime: null, paused: true }]), 't', 9999)).toBe(false)
  })
  it('notifyOnExpire=false → false', () => {
    expect(shouldFire(data([{ id: 't', endTime: 1000 }], { notifyOnExpire: false }), 't', 1000)).toBe(false)
  })
  it('config 缺失（旧数据）默认按开启', () => {
    expect(shouldFire({ timers: [{ id: 't', endTime: 1000 }] }, 't', 1000)).toBe(true)
  })
  it('远未到点 → false', () => {
    expect(shouldFire(data([{ id: 't', endTime: 100000 }]), 't', 1000)).toBe(false)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/push.test.js`
Expected: FAIL（`buildPushPayload` / `shouldFire` 未定义）

- [ ] **Step 3: 实现（追加到 `lib/push.js`）**

```js
// 构造系统通知载荷
export function buildPushPayload(timer) {
  return {
    title: '✈️ 飞行到站！',
    body: `「${timer?.label ?? '游戏时间'}」游戏时间结束啦`,
    tag: timer?.id ?? 'timebank-timer',
    url: '/?tab=timer',
  }
}

const FIRE_TOLERANCE_MS = 5000

// 到点回调时校验该计时器是否仍应通知
export function shouldFire(data, timerId, nowMs) {
  if (!data || data.config?.notifyOnExpire === false) return false
  const timer = (data.timers || []).find((t) => t.id === timerId)
  if (!timer || timer.paused || timer.endTime == null) return false
  return timer.endTime <= nowMs + FIRE_TOLERANCE_MS
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/push.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/push.js tests/push.test.js
git commit -m "feat: 通知载荷与 shouldFire 触发判定"
```

---

### Task 5: `lib/operations.js` — setTimerSchedule + notifyOnExpire 默认

**Files:**
- Modify: `lib/operations.js`
- Test: `tests/operations.test.js`

- [ ] **Step 1: 追加失败测试**

在 `tests/operations.test.js` 末尾追加：
```js
import { setTimerSchedule } from '../lib/operations.js'

describe('setTimerSchedule', () => {
  it('给指定计时器写入 scheduleId', () => {
    const data = { timers: [{ id: 'a' }, { id: 'b' }] }
    const out = setTimerSchedule(data, 'b', 'msg_1')
    expect(out.timers.find((t) => t.id === 'b').scheduleId).toBe('msg_1')
    expect(out.timers.find((t) => t.id === 'a').scheduleId).toBeUndefined()
  })
  it('可清空 scheduleId（传 null）', () => {
    const data = { timers: [{ id: 'a', scheduleId: 'x' }] }
    const out = setTimerSchedule(data, 'a', null)
    expect(out.timers[0].scheduleId).toBe(null)
  })
})

describe('getDefaultData config', () => {
  it('默认开启到站提醒', () => {
    expect(getDefaultData(TODAY).config.notifyOnExpire).toBe(true)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/operations.test.js`
Expected: FAIL（`setTimerSchedule` 未定义、`notifyOnExpire` 为 undefined）

- [ ] **Step 3: 实现**

在 `lib/operations.js` 的 `getDefaultData` 里把 config 改为：
```js
    config: { dailyExchangeLimitWeekday: 60, dailyExchangeLimitHoliday: 90, notifyOnExpire: true },
```
在文件末尾追加：
```js
// 给指定计时器写入/清除 QStash 调度 id（纯函数）
export function setTimerSchedule(data, timerId, scheduleId) {
  return {
    ...data,
    timers: (data.timers || []).map((t) =>
      t.id === timerId ? { ...t, scheduleId } : t
    ),
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/operations.test.js`
Expected: PASS（含原有用例）

- [ ] **Step 5: 提交**

```bash
git add lib/operations.js tests/operations.test.js
git commit -m "feat: setTimerSchedule 与 notifyOnExpire 默认配置"
```

---

### Task 6: `lib/qstash.js` — 排程/取消封装 + 纯 helper

**Files:**
- Create: `lib/qstash.js`
- Test: `tests/qstash.test.js`

- [ ] **Step 1: 写失败测试（仅测纯 helper）**

`tests/qstash.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { toNotBeforeSeconds, buildFireUrl } from '../lib/qstash.js'

describe('toNotBeforeSeconds', () => {
  it('毫秒向上取整为秒', () => {
    expect(toNotBeforeSeconds(1000)).toBe(1)
    expect(toNotBeforeSeconds(1500)).toBe(2)
  })
})

describe('buildFireUrl', () => {
  it('拼出带 timerId 与 token 的回调地址', () => {
    const u = buildFireUrl('https://x.app', 'timer_9', 'sek')
    expect(u).toBe('https://x.app/api/push/fire?timerId=timer_9&token=sek')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/qstash.test.js`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

`lib/qstash.js`:
```js
import { Client } from '@upstash/qstash'

let _client = null
function client() {
  if (!_client) _client = new Client({ token: process.env.QSTASH_TOKEN })
  return _client
}

// endTime(ms) → QStash notBefore（Unix 秒）
export function toNotBeforeSeconds(endTimeMs) {
  return Math.ceil(endTimeMs / 1000)
}

// 构造到点回调 URL（带 timerId 与共享密钥）
export function buildFireUrl(baseUrl, timerId, secret) {
  const u = new URL('/api/push/fire', baseUrl)
  u.searchParams.set('timerId', timerId)
  u.searchParams.set('token', secret)
  return u.toString()
}

// 解析公开站点地址：优先 PUBLIC_BASE_URL，其次 Vercel 注入的 VERCEL_URL
export function resolveBaseUrl() {
  return process.env.PUBLIC_BASE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
}

// 当前部署是否具备排程条件
export function qstashEnabled() {
  return Boolean(process.env.QSTASH_TOKEN && process.env.PUSH_FIRE_SECRET && resolveBaseUrl())
}

// 为计时器排程到点回调，返回 messageId（失败抛错由调用方兜底）
export async function scheduleTimerFire(timer, { baseUrl, secret, qstash = client() } = {}) {
  const res = await qstash.publishJSON({
    url: buildFireUrl(baseUrl, timer.id, secret),
    body: { timerId: timer.id },
    notBefore: toNotBeforeSeconds(timer.endTime),
  })
  return res?.messageId ?? null
}

// 取消已排程消息（best-effort；已投递/不存在则忽略）
export async function cancelTimerFire(scheduleId, { qstash = client() } = {}) {
  if (!scheduleId) return
  try { await qstash.messages.delete(scheduleId) } catch { /* 忽略 */ }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/qstash.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/qstash.js tests/qstash.test.js
git commit -m "feat: QStash 排程/取消封装与纯 helper"
```

---

### Task 7: `lib/webpush.js` — 发送封装与失效收集

**Files:**
- Create: `lib/webpush.js`
- Test: `tests/webpush.test.js`

- [ ] **Step 1: 写失败测试（注入 mock sender）**

`tests/webpush.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { sendToAll } from '../lib/webpush.js'

const subs = [{ endpoint: 'ok1' }, { endpoint: 'gone' }, { endpoint: 'ok2' }, { endpoint: 'err500' }]

describe('sendToAll', () => {
  it('收集 410/404 失效 endpoint，忽略其他错误', async () => {
    const sender = (sub) => {
      if (sub.endpoint === 'gone') return Promise.reject({ statusCode: 410 })
      if (sub.endpoint === 'err500') return Promise.reject({ statusCode: 500 })
      return Promise.resolve()
    }
    const failed = await sendToAll(subs, '{}', sender)
    expect(failed).toEqual(['gone'])
  })
  it('全部成功返回空数组', async () => {
    const failed = await sendToAll(subs, '{}', () => Promise.resolve())
    expect(failed).toEqual([])
  })
  it('订阅为空安全返回', async () => {
    expect(await sendToAll(undefined, '{}', () => Promise.resolve())).toEqual([])
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/webpush.test.js`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

`lib/webpush.js`:
```js
import webpush from 'web-push'

let configured = false
// 首次发送前配置 VAPID
export function configureVapid() {
  if (configured) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
  configured = true
}

// 默认真实发送器
export function realSender(sub, payloadStr) {
  return webpush.sendNotification(sub, payloadStr)
}

// 向所有订阅发送；返回失效 endpoint 列表（410/404）
export async function sendToAll(subs, payloadStr, sender = realSender) {
  const failed = []
  await Promise.all((subs || []).map(async (s) => {
    try {
      await sender(s, payloadStr)
    } catch (e) {
      const code = e?.statusCode
      if (code === 410 || code === 404) failed.push(s.endpoint)
    }
  }))
  return failed
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/webpush.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/webpush.js tests/webpush.test.js
git commit -m "feat: web-push 发送封装与失效订阅收集"
```

---

### Task 8: `lib/pushstore.js` — 订阅 Redis 读写

**Files:**
- Create: `lib/pushstore.js`

- [ ] **Step 1: 实现（薄封装，复用 db.js 的 redis 实例）**

`lib/pushstore.js`:
```js
import { redis } from './db.js'

const SUBS_KEY = 'timebank:push:subs'

// 读取所有推送订阅
export async function readSubs() {
  const subs = await redis.get(SUBS_KEY)
  return Array.isArray(subs) ? subs : []
}

// 覆盖保存推送订阅
export async function saveSubs(subs) {
  await redis.set(SUBS_KEY, subs)
  return subs
}
```

- [ ] **Step 2: 校验全部测试仍通过**

Run: `npm test`
Expected: PASS（无新单测；确认不破坏现有用例）

- [ ] **Step 3: 提交**

```bash
git add lib/pushstore.js
git commit -m "feat: 推送订阅 Redis 读写"
```

---

## Phase 2 — 服务端接口

### Task 9: `api/push/public-key.js`

**Files:**
- Create: `api/push/public-key.js`

- [ ] **Step 1: 实现**

`api/push/public-key.js`:
```js
import { requireAuth } from '../../lib/auth.js'

export default function handler(req, res) {
  if (!requireAuth(req, res)) return
  return res.status(200).json({ key: process.env.VAPID_PUBLIC_KEY || '' })
}
```

- [ ] **Step 2: 提交**

```bash
git add api/push/public-key.js
git commit -m "feat: 返回 VAPID 公钥接口"
```

---

### Task 10: `api/push/subscribe.js`

**Files:**
- Create: `api/push/subscribe.js`

- [ ] **Step 1: 实现**

`api/push/subscribe.js`:
```js
import { requireAuth } from '../../lib/auth.js'
import { readSubs, saveSubs } from '../../lib/pushstore.js'
import { upsertSubscription } from '../../lib/push.js'

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  try {
    const sub = req.body?.subscription
    if (!sub?.endpoint) return res.status(400).json({ error: '订阅无效' })
    const subs = await readSubs()
    await saveSubs(upsertSubscription(subs, sub))
    return res.status(200).json({ success: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add api/push/subscribe.js
git commit -m "feat: 保存推送订阅接口"
```

---

### Task 11: `api/push/fire.js`

**Files:**
- Create: `api/push/fire.js`

- [ ] **Step 1: 实现**

`api/push/fire.js`:
```js
import { readData } from '../../lib/db.js'
import { readSubs, saveSubs } from '../../lib/pushstore.js'
import { shouldFire, buildPushPayload, removeEndpoints } from '../../lib/push.js'
import { configureVapid, sendToAll } from '../../lib/webpush.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  // 共享密钥鉴权：密钥经 QStash 转发头 x-fire-token 传来，不在 URL 里
  const token = req.headers['x-fire-token']
  if (!process.env.PUSH_FIRE_SECRET || token !== process.env.PUSH_FIRE_SECRET) {
    return res.status(401).json({ error: '未授权' })
  }
  try {
    const timerId = req.query?.timerId
    const data = await readData()
    if (!shouldFire(data, timerId, Date.now())) {
      return res.status(200).json({ skipped: true })
    }
    const timer = data.timers.find((t) => t.id === timerId)
    configureVapid()
    const subs = await readSubs()
    const failed = await sendToAll(subs, JSON.stringify(buildPushPayload(timer)))
    if (failed.length) await saveSubs(removeEndpoints(subs, failed))
    return res.status(200).json({ sent: subs.length - failed.length, pruned: failed.length })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add api/push/fire.js
git commit -m "feat: QStash 到点回调发推送接口"
```

---

### Task 12: `api/redeem.js` — 兑换后排程

**Files:**
- Modify: `api/redeem.js`

- [ ] **Step 1: 用以下完整内容替换 `api/redeem.js`**

```js
import { requireAuth } from '../lib/auth.js'
import { readData, saveData } from '../lib/db.js'
import { redeem, setTimerSchedule } from '../lib/operations.js'
import { scheduleTimerFire, qstashEnabled, resolveBaseUrl } from '../lib/qstash.js'

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  try {
    const { tier } = req.body || {}
    const data = await readData()
    const { data: next, result } = redeem(data, tier, Date.now())

    // 排程到点推送（best-effort，失败不阻断兑换）
    let scheduleId = null
    if (qstashEnabled()) {
      try {
        scheduleId = await scheduleTimerFire(result.timer, {
          baseUrl: resolveBaseUrl(),
          secret: process.env.PUSH_FIRE_SECRET,
        })
      } catch (e) {
        console.error('[TimeBank] QStash 排程失败:', e?.message)
      }
    }

    const finalData = scheduleId ? setTimerSchedule(next, result.timer.id, scheduleId) : next
    await saveData(finalData)
    return res.status(200).json({ success: true, ...result, timer: { ...result.timer, scheduleId } })
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message })
  }
}
```

- [ ] **Step 2: 校验现有测试不受影响**

Run: `npm test`
Expected: PASS（`operations.test.js` 的 redeem 用例仍通过——纯函数未改）

- [ ] **Step 3: 提交**

```bash
git add api/redeem.js
git commit -m "feat: 兑换时排程到点推送并写回 scheduleId"
```

---

### Task 13: 暂停/继续/清除 的排程联动

**Files:**
- Modify: `api/timers/[timerId].js`
- Modify: `api/timers/clear.js`

- [ ] **Step 1: 用以下完整内容替换 `api/timers/[timerId].js`**

```js
import { requireAuth } from '../../lib/auth.js'
import { readData, saveData } from '../../lib/db.js'
import { pauseTimer, resumeTimer, setTimerSchedule } from '../../lib/operations.js'
import { scheduleTimerFire, cancelTimerFire, qstashEnabled, resolveBaseUrl } from '../../lib/qstash.js'

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  const { timerId } = req.query
  const { action } = req.body || {}
  try {
    const data = await readData()

    if (action === 'pause') {
      const prev = (data.timers || []).find((t) => t.id === timerId)
      const { data: next, result } = pauseTimer(data, timerId, Date.now())
      if (qstashEnabled()) await cancelTimerFire(prev?.scheduleId)
      const finalData = setTimerSchedule(next, timerId, null)
      await saveData(finalData)
      return res.status(200).json({ success: true, timer: { ...result.timer, scheduleId: null } })
    }

    if (action === 'resume') {
      const { data: next, result } = resumeTimer(data, timerId, Date.now())
      let scheduleId = null
      if (qstashEnabled()) {
        try {
          scheduleId = await scheduleTimerFire(result.timer, {
            baseUrl: resolveBaseUrl(),
            secret: process.env.PUSH_FIRE_SECRET,
          })
        } catch (e) {
          console.error('[TimeBank] QStash 重排失败:', e?.message)
        }
      }
      const finalData = setTimerSchedule(next, timerId, scheduleId)
      await saveData(finalData)
      return res.status(200).json({ success: true, timer: { ...result.timer, scheduleId } })
    }

    return res.status(400).json({ error: '未知操作' })
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message })
  }
}
```

- [ ] **Step 2: 用以下完整内容替换 `api/timers/clear.js`**

```js
import { requireAuth } from '../../lib/auth.js'
import { readData, saveData } from '../../lib/db.js'
import { clearExpiredTimers } from '../../lib/operations.js'
import { cancelTimerFire, qstashEnabled } from '../../lib/qstash.js'

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  try {
    const data = await readData()
    const now = Date.now()
    // 被清除的（已过期、未暂停）计时器，取消其残留排程（多数已投递，取消为 best-effort）
    const removed = (data.timers || []).filter((t) => !t.paused && t.endTime != null && t.endTime <= now)
    const { data: next, result } = clearExpiredTimers(data, now)
    if (qstashEnabled()) {
      await Promise.all(removed.map((t) => cancelTimerFire(t.scheduleId)))
    }
    await saveData(next)
    return res.status(200).json({ success: true, removed: result.removed })
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message })
  }
}
```

- [ ] **Step 3: 校验测试**

Run: `npm test`
Expected: PASS（纯函数 pause/resume/clear 用例不受影响）

- [ ] **Step 4: 提交**

```bash
git add api/timers/[timerId].js api/timers/clear.js
git commit -m "feat: 暂停取消/继续重排/清除取消 到点推送排程"
```

---

## Phase 3 — 前台到站音

### Task 14: `src/utils/timerChime.js` — pickNewlyExpired（TDD）

**Files:**
- Create: `src/utils/timerChime.js`
- Test: `tests/timerChime.test.js`

- [ ] **Step 1: 写失败测试**

`tests/timerChime.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { pickNewlyExpired } from '../src/utils/timerChime.js'

const timers = [
  { id: 'a', endTime: 1000 },
  { id: 'b', endTime: 9999 },
  { id: 'c', endTime: null, paused: true, remainingMs: 100 },
  { id: 'd', endTime: 800 },
]

describe('pickNewlyExpired', () => {
  it('返回已到点、未暂停、未响过的 id', () => {
    expect(pickNewlyExpired(timers, new Set(), 1000).sort()).toEqual(['a', 'd'])
  })
  it('跳过已响过的', () => {
    expect(pickNewlyExpired(timers, new Set(['a']), 1000)).toEqual(['d'])
  })
  it('未到点的不返回', () => {
    expect(pickNewlyExpired(timers, new Set(), 900)).toEqual(['d'])
  })
  it('firedIds 支持数组', () => {
    expect(pickNewlyExpired(timers, ['a', 'd'], 1000)).toEqual([])
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/timerChime.test.js`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现**

`src/utils/timerChime.js`:
```js
// 找出"刚到站且尚未响过"的计时器 id（纯函数）
export function pickNewlyExpired(timers, firedIds, nowMs) {
  const fired = firedIds instanceof Set ? firedIds : new Set(firedIds || [])
  return (timers || [])
    .filter((t) => !t.paused && t.endTime != null && t.endTime <= nowMs && !fired.has(t.id))
    .map((t) => t.id)
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/timerChime.test.js`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add src/utils/timerChime.js tests/timerChime.test.js
git commit -m "feat: pickNewlyExpired 纯函数"
```

---

### Task 15: `src/utils/arrivalSound.js` — 到站音频控制

**Files:**
- Create: `src/utils/arrivalSound.js`

- [ ] **Step 1: 实现**

`src/utils/arrivalSound.js`:
```js
// 到站音：播放用户提供的广州地铁关门铃声（约 6.8 秒，播一遍）
let audioEl = null
let unlocked = false

function el() {
  if (!audioEl) {
    audioEl = new Audio('/sounds/arrival.mp3')
    audioEl.preload = 'auto'
  }
  return audioEl
}

// 首个用户手势时调用，解锁移动端自动播放限制
export function unlockArrivalSound() {
  if (unlocked) return
  const a = el()
  a.muted = true
  a.play()
    .then(() => { a.pause(); a.currentTime = 0; a.muted = false; unlocked = true })
    .catch(() => { a.muted = false })
}

// 从头播放一遍
export function playArrivalSound() {
  const a = el()
  try { a.currentTime = 0 } catch { /* 忽略 */ }
  a.loop = false // 文件约 6.8 秒，播一遍即可
  return a.play().catch(() => {})
}

// 立即停止
export function stopArrivalSound() {
  if (!audioEl) return
  audioEl.pause()
  try { audioEl.currentTime = 0 } catch { /* 忽略 */ }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/utils/arrivalSound.js
git commit -m "feat: 到站音频播放/停止/解锁"
```

---

### Task 16: `useTimerChime` Hook + App 接入 + 到站横幅

**Files:**
- Create: `src/hooks/useTimerChime.js`
- Modify: `src/App.jsx`

- [ ] **Step 1: 实现 Hook**

`src/hooks/useTimerChime.js`:
```js
import { useEffect, useRef, useState } from 'react'
import { pickNewlyExpired } from '../utils/timerChime'
import { playArrivalSound, stopArrivalSound, unlockArrivalSound } from '../utils/arrivalSound'

const FIRED_KEY = 'timebank-chimed-timers'

function loadFired() {
  try { return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) || '[]')) } catch { return new Set() }
}
function saveFired(set) {
  try { localStorage.setItem(FIRED_KEY, JSON.stringify([...set])) } catch { /* 忽略 */ }
}

export default function useTimerChime(timers) {
  const firedRef = useRef(loadFired())
  const timeoutsRef = useRef(new Map())
  const [arrivedCount, setArrivedCount] = useState(0)

  // 首个用户手势解锁音频
  useEffect(() => {
    const onGesture = () => { unlockArrivalSound() }
    window.addEventListener('pointerdown', onGesture, { once: true })
    return () => window.removeEventListener('pointerdown', onGesture)
  }, [])

  const fire = (ids) => {
    if (!ids.length) return
    ids.forEach((id) => firedRef.current.add(id))
    saveFired(firedRef.current)
    setArrivedCount((c) => c + ids.length)
    playArrivalSound()
  }

  // 为每个未来到站的计时器设精确 setTimeout；并立即补响"加载前已到站"的
  useEffect(() => {
    const now = Date.now()
    fire(pickNewlyExpired(timers, firedRef.current, now))

    timeoutsRef.current.forEach((h) => clearTimeout(h))
    timeoutsRef.current.clear()

    ;(timers || []).forEach((t) => {
      if (t.paused || t.endTime == null) return
      const delay = t.endTime - now
      if (delay <= 0 || firedRef.current.has(t.id)) return
      const h = setTimeout(() => fire([t.id]), delay)
      timeoutsRef.current.set(t.id, h)
    })

    // 清理已不存在的 id，避免 localStorage 无限增长
    const present = new Set((timers || []).map((t) => t.id))
    let changed = false
    firedRef.current.forEach((id) => { if (!present.has(id)) { firedRef.current.delete(id); changed = true } })
    if (changed) saveFired(firedRef.current)

    return () => {
      timeoutsRef.current.forEach((h) => clearTimeout(h))
      timeoutsRef.current.clear()
    }
  }, [timers])

  // 回到前台补响（隐藏期间到站的）
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fire(pickNewlyExpired(timers, firedRef.current, Date.now()))
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [timers])

  const dismiss = () => { stopArrivalSound(); setArrivedCount(0) }
  return { arrivedCount, dismiss }
}
```

- [ ] **Step 2: 在 `src/App.jsx` 接入 Hook**

在 import 区追加：
```js
import useTimerChime from './hooks/useTimerChime';
```
在 `const timers = useStore((s) => s.timers);` 之后追加：
```js
    const { arrivedCount, dismiss } = useTimerChime(timers);
```

- [ ] **Step 3: 在 `src/App.jsx` 处理通知点击深链 `?tab=timer`**

在 `useEffect(() => { loadData(); }, [loadData]);` 之后追加：
```js
    // 来自系统通知点击：?tab=timer 直接切到计时页
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('tab') === 'timer') setActiveTab('timer');
    }, []);
```

- [ ] **Step 4: 在 `src/App.jsx` 渲染到站横幅**

在 `{pointsAnim && (` 这一块之前插入：
```jsx
            {/* ===== 到站提示横幅 ===== */}
            {arrivedCount > 0 && (
                <button
                    onClick={dismiss}
                    className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] bg-sunset text-white font-bold text-sm px-5 py-2.5 rounded-full shadow-lg animate-bounce"
                    style={{ maxWidth: '90vw' }}
                >
                    ✈️ {arrivedCount} 个飞行已到站 · 点此停止
                </button>
            )}
```

- [ ] **Step 5: 启动 dev 手动验证**

Run: `npm run dev`，浏览器打开应用并登录。
手动验证：
1. 兑换一个最短时长的计时；停留在"任务"tab（非计时页）。
2. 到点时应自动播放地铁关门铃声，并出现顶部「✈️ 1 个飞行已到站 · 点此停止」横幅。
3. 点横幅 → 声音立即停止、横幅消失。
4. 兑换后切到别的浏览器标签，到点后切回 → 触发补响。
Expected: 上述行为均符合。

- [ ] **Step 6: 提交**

```bash
git add src/hooks/useTimerChime.js src/App.jsx
git commit -m "feat: 前台到站音 Hook、深链与到站横幅"
```

---

## Phase 4 — PWA 与后台推送客户端

### Task 17: PWA 图标

**Files:**
- Create: `public/icons/icon.svg`
- Create: `scripts/gen-icons.mjs`
- Create（生成物）: `public/icons/icon-192.png` / `icon-512.png` / `apple-touch-icon-180.png`

- [ ] **Step 1: 写图标 SVG**

`public/icons/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0d1b2a"/>
  <g transform="translate(256,256) rotate(45)">
    <path fill="#4fc3f7" d="M0,-150 L26,-40 L150,30 L150,66 L26,40 L20,120 L60,150 L60,172 L0,150 L-60,172 L-60,150 L-20,120 L-26,40 L-150,66 L-150,30 L-26,-40 Z"/>
  </g>
</svg>
```

- [ ] **Step 2: 写生成脚本**

`scripts/gen-icons.mjs`:
```js
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url))
const out = (size, name) =>
  sharp(svg).resize(size, size).png().toFile(fileURLToPath(new URL(`../public/icons/${name}`, import.meta.url)))

await Promise.all([
  out(192, 'icon-192.png'),
  out(512, 'icon-512.png'),
  out(180, 'apple-touch-icon-180.png'),
])
console.log('icons generated')
```

- [ ] **Step 3: 生成 PNG**

Run: `node scripts/gen-icons.mjs && ls -la public/icons/`
Expected: 输出 `icons generated`，目录下出现 `icon-192.png`、`icon-512.png`、`apple-touch-icon-180.png`。

- [ ] **Step 4: 提交**

```bash
git add public/icons/icon.svg scripts/gen-icons.mjs public/icons/icon-192.png public/icons/icon-512.png public/icons/apple-touch-icon-180.png
git commit -m "feat: PWA 图标与生成脚本"
```

---

### Task 18: PWA manifest 与 index.html

**Files:**
- Create: `public/manifest.webmanifest`
- Modify: `index.html`

- [ ] **Step 1: 写 manifest**

`public/manifest.webmanifest`:
```json
{
  "name": "TimeBank 时间银行",
  "short_name": "TimeBank",
  "start_url": "/?tab=timer",
  "display": "standalone",
  "background_color": "#0d1b2a",
  "theme_color": "#0d1b2a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 2: 在 `index.html` 的 `<head>` 内追加引用**

在 `<head>` 中（字体 link 附近）加入：
```html
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="theme-color" content="#0d1b2a" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png" />
```

- [ ] **Step 3: 提交**

```bash
git add public/manifest.webmanifest index.html
git commit -m "feat: PWA manifest 与 head 引用"
```

---

### Task 19: Service Worker

**Files:**
- Create: `public/sw.js`

- [ ] **Step 1: 实现**

`public/sw.js`:
```js
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = {} }
  const title = data.title || '✈️ 飞行到站！'
  const options = {
    body: data.body || '游戏时间结束啦',
    tag: data.tag || 'timebank-timer',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: true,
    data: { url: data.url || '/?tab=timer' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/?tab=timer'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          if (c.navigate) c.navigate(url)
          return c.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
```

- [ ] **Step 2: 提交**

```bash
git add public/sw.js
git commit -m "feat: Service Worker 处理 push 与通知点击"
```

---

### Task 20: 推送客户端与 SW 注册

**Files:**
- Create: `src/utils/push-client.js`
- Modify: `src/main.jsx`

- [ ] **Step 1: 实现 push-client**

`src/utils/push-client.js`:
```js
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}
export function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}
export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  return navigator.serviceWorker.register('/sw.js')
}

// 请求权限 + 订阅 + 上报；成功返回 true，否则抛错（message 可直接展示）
export async function enablePush() {
  if (!pushSupported()) throw new Error('当前环境不支持推送')
  const reg = await registerServiceWorker()
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('未授予通知权限')

  const keyRes = await fetch('/api/push/public-key', { credentials: 'include' })
  const { key } = await keyRes.json()
  if (!key) throw new Error('服务端未配置推送公钥')

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key),
  })
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub }),
  })
  if (!res.ok) throw new Error('订阅上报失败')
  return true
}
```

- [ ] **Step 2: 在 `src/main.jsx` 注册 SW**

在 `src/main.jsx` 末尾追加：
```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
```

- [ ] **Step 3: 提交**

```bash
git add src/utils/push-client.js src/main.jsx
git commit -m "feat: 推送订阅客户端与 Service Worker 注册"
```

---

### Task 21: AdminPanel「到站提醒」设置区 + store action

**Files:**
- Modify: `src/store.js`
- Modify: `src/components/AdminPanel.jsx`

- [ ] **Step 1: 在 `src/store.js` 增加 store action**

在 `importData` action 之前（约第 339 行 `exportData` 之上）追加：
```js
    // === 切换到站后台通知开关（持久化到 config）===
    setNotifyOnExpire: async (enabled) => {
        const state = get();
        const config = { ...state.config, notifyOnExpire: enabled };
        set({ config });
        try {
            await api.saveData({
                balance: state.balance,
                tasks: state.tasks,
                logs: state.logs,
                timers: state.timers,
                config,
            });
        } catch (error) {
            console.error('[TimeBank] 保存提醒开关失败:', error);
        }
    },
```

- [ ] **Step 2: 在 `src/components/AdminPanel.jsx` 顶部 import 推送工具**

在 AdminPanel 的 import 区追加：
```js
import { enablePush, pushSupported, isIos, isStandalone } from '../utils/push-client';
import { useState } from 'react';
import useStore from '../store';
```
（若文件已 import `useState` / `useStore`，则不要重复添加，仅补 `push-client` 的那一行。）

- [ ] **Step 3: 在 AdminPanel 组件内加入提醒设置区**

在组件函数体内、return 之前加入状态与处理函数：
```js
    const config = useStore((s) => s.config);
    const setNotifyOnExpire = useStore((s) => s.setNotifyOnExpire);
    const [pushMsg, setPushMsg] = useState('');
    const iosNeedsInstall = isIos() && !isStandalone();

    const handleEnablePush = async () => {
        setPushMsg('正在开启…');
        try {
            await enablePush();
            setPushMsg('✅ 已开启后台到站提醒');
        } catch (e) {
            setPushMsg('❌ ' + (e?.message || '开启失败'));
        }
    };
```
在面板内容里（任意设置分组处）加入这段 UI：
```jsx
                <div className="card-comic">
                    <div className="relative z-10 space-y-3">
                        <h3 className="text-sky font-bold text-sm">🔔 到站提醒</h3>

                        <label className="flex items-center justify-between text-sm text-cloud">
                            <span>后台系统通知（锁屏/切走时）</span>
                            <input
                                type="checkbox"
                                checked={config?.notifyOnExpire !== false}
                                onChange={(e) => setNotifyOnExpire(e.target.checked)}
                            />
                        </label>

                        {iosNeedsInstall ? (
                            <p className="text-xs text-cloud-dark leading-relaxed">
                                📱 iPhone/iPad 需先把本应用「添加到主屏幕」：点浏览器分享按钮 → 添加到主屏幕 → 从主屏幕图标打开后，再回到这里开启提醒。
                            </p>
                        ) : pushSupported() ? (
                            <button className="btn-primary w-full" onClick={handleEnablePush}>
                                开启本设备的到站提醒
                            </button>
                        ) : (
                            <p className="text-xs text-cloud-dark">当前环境不支持后台通知。</p>
                        )}

                        {pushMsg && <p className="text-xs text-cloud-dark">{pushMsg}</p>}
                    </div>
                </div>
```

- [ ] **Step 4: dev 验证（桌面 Chrome）**

Run: `npm run dev`，登录后打开设置（⚙️）面板。
手动验证：
1. 出现「🔔 到站提醒」区与「开启本设备的到站提醒」按钮。
2. 点按钮 → 浏览器弹通知权限 → 允许 → 显示「✅ 已开启后台到站提醒」。
3. 勾选框可切换，刷新后保持（说明已持久化到 config）。
Expected: 符合（注意：本地 dev `http://localhost` 是安全上下文，SW 可注册；但 QStash 回调打不到 localhost，后台推送的端到端验证放在已部署环境，见 Task 22）。

- [ ] **Step 5: 提交**

```bash
git add src/store.js src/components/AdminPanel.jsx
git commit -m "feat: AdminPanel 到站提醒设置与订阅入口"
```

---

## Phase 5 — 验证与收尾

### Task 22: 全量验证与部署端到端测试

**Files:** 无（验证 + 配置）

- [ ] **Step 1: 跑全部单测**

Run: `npm test`
Expected: 全部 PASS（push / qstash / webpush / timerChime / operations 等）。

- [ ] **Step 2: 构建检查**

Run: `npm run build`
Expected: 构建成功，无报错。

- [ ] **Step 3: 在 Vercel 配置环境变量**

在 Vercel 项目设置中配置（Production + Preview）：
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`（用 `npx web-push generate-vapid-keys` 生成）
- `QSTASH_TOKEN`（Upstash 控制台 → QStash）
- `PUSH_FIRE_SECRET`（`openssl rand -hex 32`）
- `PUBLIC_BASE_URL`（如 `https://timebank.vercel.app`）

部署：`git push` 触发，或按项目既有部署流程。

- [ ] **Step 4: 真机端到端验证（iPhone）**

1. Safari 打开生产域名 → 分享 → 添加到主屏幕。
2. 从主屏幕图标打开（standalone）→ 进设置开启到站提醒，授予通知权限。
3. 兑换一个 1 分钟计时 → 锁屏。
4. 约 1 分钟后应收到系统通知「✈️ 飞行到站！」+ 振动；点通知打开应用并停在「计时」页。

- [ ] **Step 5: 桌面/安卓验证后台通知**

桌面 Chrome：开启提醒 → 兑换短计时 → 切到别的应用/最小化 → 到点收到系统通知。

- [ ] **Step 6: 前台与暂停回归**

1. 前台：兑换短计时停在"任务"页 → 到点播放地铁铃声 + 横幅。
2. 暂停一个计时再等过原定到点时间 → 不应收到后台通知（排程已取消）。
3. 继续后重新到点 → 收到通知。

- [ ] **Step 7: 完成开发分支**

REQUIRED SUB-SKILL: 用 superpowers:finishing-a-development-branch 决定合并/PR/清理。

---

## 自检清单（写计划后回看）

- **spec 覆盖**：前台地铁音(§4/§6)→Task 14-16；后台 QStash 推送(§3/§8)→Task 6-13；PWA/SW/iOS 引导(§7)→Task 17-21；数据模型(§5)→Task 5、8；前置条件(§9)→Task 1、22；测试(§11)→Task 3-7、14、22。✅
- **占位符**：无 TBD/TODO，所有代码步骤含完整代码。✅
- **命名一致**：`scheduleTimerFire`/`cancelTimerFire`/`setTimerSchedule`/`shouldFire`/`sendToAll`/`pickNewlyExpired`/`enablePush` 在定义与调用处一致；`notifyOnExpire`、`timebank:push:subs`、`/sounds/arrival.mp3`、`?tab=timer` 全局统一。✅
- **偏差已记录**：fire 端用共享密钥 token 取代 QStash 签名（见顶部「与 spec 的一处偏差」）。✅
