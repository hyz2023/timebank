# Vercel 迁移 + 登录鉴权 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 TimeBank 从"局域网 Express + 本地 JSON 文件"改造成"Vercel Serverless Functions + Upstash Redis + 共享密码全站门禁"，业务功能与体验完全不变。

**Architecture:** 前端 React 静态站由 Vercel 托管；所有业务逻辑作为纯函数放在顶层 `/lib`（可单元测试）；`/api` 下的 Serverless Functions 是薄胶水层，入口统一 `requireAuth` 校验签名 Cookie，再调用 `/lib` 操作函数，数据读写走 Upstash Redis 单 key。

**Tech Stack:** React 19 + Vite（前端，不动）、Node Serverless Functions（`/api`）、`@upstash/redis`、Node 内置 `crypto`（签名/常量时间比较）、Vitest（单元测试）。

**测试策略：** 所有业务逻辑都抽到 `/lib` 的纯函数里，用 Vitest 做 TDD（注入时间参数，保证确定性）。`/api` 处理函数和前端组件是薄胶水层，通过部署到 Vercel Preview 后按"验收清单"手动冒烟验证（对非技术用户更现实）。

**与 spec 的微调：** spec 写的是 `/api/_lib`；本计划改为顶层 `/lib`。原因：Vercel 把 `/api` 下每个文件都当作一个接口端点，而顶层 `/lib` 既能被 `/api` 导入打包，又方便测试从 `/tests` 直接导入，边界更干净。

---

## File Structure

**新建（共享逻辑，纯函数，可测试）：**
- `lib/time.js` — 北京时区日期工具
- `lib/engine.js` — 积分计算与衰减率（服务端权威口径）
- `lib/auth.js` — 会话签名/校验、Cookie 构造、`requireAuth`
- `lib/operations.js` — 全部业务数据变换（earn/redeem/timers/tasks/balance/每日重置）
- `lib/db.js` — Upstash Redis 客户端 + `readData`/`saveData`
- `lib/ratelimit.js` — 登录失败限流

**新建（Serverless 接口端点，薄胶水）：**
- `api/login.js`、`api/logout.js`、`api/session.js`
- `api/data.js`、`api/earn.js`、`api/redeem.js`、`api/balance.js`
- `api/tasks/index.js`、`api/tasks/[taskId].js`
- `api/timers/clear.js`、`api/timers/[timerId].js`

**新建（测试 / 脚本 / 配置 / 文档）：**
- `tests/time.test.js`、`tests/engine.test.js`、`tests/auth.test.js`、`tests/operations.test.js`
- `scripts/migrate-from-lan.mjs` — 从老服务器抓数据导入 Redis
- `vercel.json`、`.env.example`、`vitest.config.js`
- `docs/DEPLOY.md` — 给用户的逐步部署/迁移指南

**修改：**
- `src/store.js` — `API_BASE` 改相对路径、携带 Cookie、暂停/继续改单端点、401 处理
- `src/main.jsx` — 用 `AuthGate` 包裹 `App`
- `package.json` — 加 `@upstash/redis` 依赖、`vitest` devDep、test 脚本
- `.gitignore` — 忽略 `.env`、`.vercel`
- 新增 `src/components/LoginPage.jsx`、`src/components/AuthGate.jsx`

**保持不变：** `src/App.jsx`、`src/engine.js`、所有页面与图表组件、`src/store.js` 的业务方法签名（仅内部 fetch 细节调整）。老 `server/` 目录保留作备份，不删除、不再使用。

---

## Task 1: 搭建 Vitest 测试环境

**Files:**
- Modify: `package.json`
- Create: `vitest.config.js`
- Create: `tests/smoke.test.js`（临时，验证框架，最后删除）

- [ ] **Step 1: 安装 Vitest**

Run:
```bash
npm install -D vitest
```

- [ ] **Step 2: 创建 `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
})
```

- [ ] **Step 3: 在 `package.json` 的 `scripts` 中加入测试命令**

把 `scripts` 改成：
```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

- [ ] **Step 4: 写一个临时冒烟测试 `tests/smoke.test.js`**

```js
import { describe, it, expect } from 'vitest'

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: 运行测试，确认框架工作**

Run: `npm test`
Expected: PASS，1 个测试通过。

- [ ] **Step 6: 删除临时测试并提交**

```bash
rm tests/smoke.test.js
git add package.json package-lock.json vitest.config.js
git commit -m "chore: 引入 Vitest 测试环境"
```

---

## Task 2: `lib/time.js` 北京时区日期

**Files:**
- Create: `lib/time.js`
- Test: `tests/time.test.js`

- [ ] **Step 1: 写失败测试 `tests/time.test.js`**

```js
import { describe, it, expect } from 'vitest'
import { getBeijingDateStr } from '../lib/time.js'

describe('getBeijingDateStr', () => {
  it('当 UTC 23:59 时北京已是次日凌晨', () => {
    // 2026-06-14T16:30:00Z + 8h = 2026-06-15T00:30 北京
    expect(getBeijingDateStr(new Date('2026-06-14T16:30:00Z'))).toBe('2026-06-15')
  })

  it('当 UTC 15:59 时北京仍是当天 23:59', () => {
    expect(getBeijingDateStr(new Date('2026-06-14T15:59:59Z'))).toBe('2026-06-14')
  })

  it('月初跨月正确', () => {
    // 2026-01-31T20:00Z + 8h = 2026-02-01 04:00 北京
    expect(getBeijingDateStr(new Date('2026-01-31T20:00:00Z'))).toBe('2026-02-01')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test -- time`
Expected: FAIL，提示找不到 `getBeijingDateStr` / 模块不存在。

- [ ] **Step 3: 实现 `lib/time.js`**

```js
// 北京时间 (UTC+8) 日期工具
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000

// 给定时间点，返回北京时区下的 YYYY-MM-DD 字符串
export function getBeijingDateStr(date = new Date()) {
  const beijing = new Date(date.getTime() + BEIJING_OFFSET_MS)
  const y = beijing.getUTCFullYear()
  const m = String(beijing.getUTCMonth() + 1).padStart(2, '0')
  const d = String(beijing.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npm test -- time`
Expected: PASS，3 个测试通过。

- [ ] **Step 5: 提交**

```bash
git add lib/time.js tests/time.test.js
git commit -m "feat: 添加北京时区日期工具 lib/time.js"
```

---

## Task 3: `lib/engine.js` 积分计算（服务端权威口径）

**Files:**
- Create: `lib/engine.js`
- Test: `tests/engine.test.js`

> 口径必须与现有 `server/server.js` 完全一致：本次完成时 `count = dailyCount + 1`；`count >= 5` → 0.5，`count >= 3` → 0.75，否则 1.0；基础分与完美奖励都参与衰减；结果四舍五入到两位小数。

- [ ] **Step 1: 写失败测试 `tests/engine.test.js`**

```js
import { describe, it, expect } from 'vitest'
import { getDecayMultiplier, calculatePoints } from '../lib/engine.js'

describe('getDecayMultiplier', () => {
  it('第 1、2 次为 1.0', () => {
    expect(getDecayMultiplier(0)).toBe(1.0)
    expect(getDecayMultiplier(1)).toBe(1.0)
  })
  it('第 3、4 次为 0.75', () => {
    expect(getDecayMultiplier(2)).toBe(0.75)
    expect(getDecayMultiplier(3)).toBe(0.75)
  })
  it('第 5 次及以后为 0.5', () => {
    expect(getDecayMultiplier(4)).toBe(0.5)
    expect(getDecayMultiplier(9)).toBe(0.5)
  })
})

describe('calculatePoints', () => {
  const task = { basePoints: 4, bonusPoints: 2, dailyCount: 0 }
  it('普通完成只算基础分', () => {
    expect(calculatePoints(task, false)).toBe(4)
  })
  it('完美完成加奖励分', () => {
    expect(calculatePoints(task, true)).toBe(6)
  })
  it('第 3 次完美完成按 0.75 衰减', () => {
    expect(calculatePoints({ ...task, dailyCount: 2 }, true)).toBe(4.5)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test -- engine`
Expected: FAIL，找不到模块/函数。

- [ ] **Step 3: 实现 `lib/engine.js`**

```js
// TimeBank 服务端积分计算引擎（权威口径，与前端 src/engine.js 保持一致）

// 根据"当前已完成次数"返回本次的衰减系数
export function getDecayMultiplier(currentDailyCount) {
  const next = currentDailyCount + 1
  if (next >= 5) return 0.5
  if (next >= 3) return 0.75
  return 1.0
}

// 计算本次任务得分（含衰减与完美奖励），四舍五入到两位小数
export function calculatePoints(task, isPerfect) {
  const multiplier = getDecayMultiplier(task.dailyCount)
  let points = task.basePoints * multiplier
  if (isPerfect) points += task.bonusPoints * multiplier
  return Math.round(points * 100) / 100
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npm test -- engine`
Expected: PASS，全部通过。

- [ ] **Step 5: 提交**

```bash
git add lib/engine.js tests/engine.test.js
git commit -m "feat: 添加服务端积分计算引擎 lib/engine.js"
```

---

## Task 4: `lib/auth.js` 会话签名与 Cookie

**Files:**
- Create: `lib/auth.js`
- Test: `tests/auth.test.js`

> 会话令牌格式：`base64url(JSON{exp}) + "." + HMAC-SHA256(payload, secret)`。校验时重算 HMAC 并用 `timingSafeEqual` 常量时间比较，再检查 `exp > now`。

- [ ] **Step 1: 写失败测试 `tests/auth.test.js`**

```js
import { describe, it, expect } from 'vitest'
import { signSession, verifySession, parseCookie, COOKIE_NAME } from '../lib/auth.js'

const SECRET = 'test-secret'
const NOW = 1_000_000

describe('signSession / verifySession', () => {
  it('合法且未过期的令牌通过校验', () => {
    const token = signSession(SECRET, NOW + 10_000)
    expect(verifySession(SECRET, token, NOW)).toBe(true)
  })
  it('过期令牌不通过', () => {
    const token = signSession(SECRET, NOW - 1)
    expect(verifySession(SECRET, token, NOW)).toBe(false)
  })
  it('错误密钥签发的令牌不通过', () => {
    const token = signSession('other-secret', NOW + 10_000)
    expect(verifySession(SECRET, token, NOW)).toBe(false)
  })
  it('被篡改的令牌不通过', () => {
    const token = signSession(SECRET, NOW + 10_000) + 'x'
    expect(verifySession(SECRET, token, NOW)).toBe(false)
  })
  it('空令牌不通过', () => {
    expect(verifySession(SECRET, '', NOW)).toBe(false)
    expect(verifySession(SECRET, null, NOW)).toBe(false)
  })
})

describe('parseCookie', () => {
  it('能取出指定 cookie 值', () => {
    expect(parseCookie(`a=1; ${COOKIE_NAME}=abc.def; b=2`, COOKIE_NAME)).toBe('abc.def')
  })
  it('不存在时返回 null', () => {
    expect(parseCookie('a=1', COOKIE_NAME)).toBe(null)
    expect(parseCookie(undefined, COOKIE_NAME)).toBe(null)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test -- auth`
Expected: FAIL，找不到模块。

- [ ] **Step 3: 实现 `lib/auth.js`**

```js
import crypto from 'node:crypto'

export const COOKIE_NAME = 'tb_session'
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 天

function b64urlEncode(str) {
  return Buffer.from(str).toString('base64url')
}

// 签发会话令牌；expMs 为过期时间（epoch 毫秒）
export function signSession(secret, expMs) {
  const payload = b64urlEncode(JSON.stringify({ exp: expMs }))
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

// 校验令牌：签名正确且未过期返回 true
export function verifySession(secret, token, nowMs) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false
  const [payload, sig] = token.split('.')
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return typeof exp === 'number' && exp > nowMs
  } catch {
    return false
  }
}

// 从 Cookie 头里取出指定名字的值
export function parseCookie(header, name) {
  if (!header) return null
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const k = part.slice(0, idx).trim()
    if (k === name) return decodeURIComponent(part.slice(idx + 1).trim())
  }
  return null
}

// 构造登录 Set-Cookie 头
export function buildSessionCookie(token) {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000)
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
}

// 构造清除登录的 Set-Cookie 头
export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
}

// Serverless 入口守卫：未授权时写 401 并返回 false
export function requireAuth(req, res) {
  const secret = process.env.SESSION_SECRET
  const token = parseCookie(req.headers?.cookie, COOKIE_NAME)
  if (secret && verifySession(secret, token, Date.now())) return true
  res.status(401).json({ error: '未授权' })
  return false
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npm test -- auth`
Expected: PASS，全部通过。

- [ ] **Step 5: 提交**

```bash
git add lib/auth.js tests/auth.test.js
git commit -m "feat: 添加会话签名与鉴权工具 lib/auth.js"
```

---

## Task 5: `lib/operations.js`（一）默认数据 / 每日重置 / 加分 / 调余额

**Files:**
- Create: `lib/operations.js`
- Test: `tests/operations.test.js`

> 业务逻辑必须与 `server/server.js` 一致。所有函数是纯函数：接收 `data` 与时间参数，返回 `{ data, result }`（不修改入参）。错误用 `OperationError`（带 `statusCode`）抛出。
> 与旧逻辑的唯一有意微调：余额在加/减后四舍五入到两位小数（避免浮点漂移，显示层用 `toFixed(2)`，视觉完全等价）。

- [ ] **Step 1: 写失败测试 `tests/operations.test.js`**

```js
import { describe, it, expect } from 'vitest'
import {
  getDefaultData, applyDailyReset, earn, adjustBalance, OperationError,
} from '../lib/operations.js'

const TODAY = '2026-06-14'

describe('getDefaultData', () => {
  it('包含 8 个默认任务且余额为 0，任务 lastUpdate 为今天', () => {
    const d = getDefaultData(TODAY)
    expect(d.balance).toBe(0)
    expect(d.tasks).toHaveLength(8)
    expect(d.tasks.every((t) => t.lastUpdate === TODAY)).toBe(true)
    expect(d.logs).toEqual([])
    expect(d.timers).toEqual([])
  })
})

describe('applyDailyReset', () => {
  it('lastUpdate 不是今天的任务被清零', () => {
    const data = getDefaultData('2026-06-13')
    data.tasks[0].dailyCount = 3
    const out = applyDailyReset(data, TODAY)
    expect(out.tasks[0].dailyCount).toBe(0)
    expect(out.tasks[0].lastUpdate).toBe(TODAY)
  })
  it('已是今天则原样返回（同一引用）', () => {
    const data = getDefaultData(TODAY)
    expect(applyDailyReset(data, TODAY)).toBe(data)
  })
})

describe('earn', () => {
  it('普通完成加基础分并记录日志', () => {
    const data = getDefaultData(TODAY)
    const { data: next, result } = earn(data, 't3', false, TODAY, 111)
    expect(result.points).toBe(4) // t3 basePoints=4
    expect(result.newBalance).toBe(4)
    expect(result.dailyCount).toBe(1)
    expect(next.logs[0].type).toBe('EARN')
    expect(next.logs[0].pointsChange).toBe(4)
    expect(data.balance).toBe(0) // 入参未被修改
  })
  it('任务不存在抛 404', () => {
    const data = getDefaultData(TODAY)
    expect(() => earn(data, 'nope', false, TODAY, 1)).toThrow(OperationError)
  })
})

describe('adjustBalance', () => {
  it('正数加分，余额不为负', () => {
    const data = getDefaultData(TODAY)
    const { data: next, result } = adjustBalance(data, 5, 222)
    expect(result.newBalance).toBe(5)
    expect(next.logs[0].meta.admin).toBe(true)
  })
  it('扣到负数时归零', () => {
    const data = getDefaultData(TODAY)
    const { result } = adjustBalance(data, -10, 333)
    expect(result.newBalance).toBe(0)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test -- operations`
Expected: FAIL，找不到模块。

- [ ] **Step 3: 实现 `lib/operations.js`（首段）**

```js
import { calculatePoints, getDecayMultiplier } from './engine.js'

// 带 HTTP 状态码的业务错误
export class OperationError extends Error {
  constructor(statusCode, message) {
    super(message)
    this.statusCode = statusCode
    this.name = 'OperationError'
  }
}

function round2(n) {
  return Math.round(n * 100) / 100
}

// 默认初始数据（today 为北京日期字符串）
export function getDefaultData(today) {
  return {
    balance: 0,
    tasks: [
      { id: 't1', name: '练字', basePoints: 3, bonusPoints: 0, dailyCount: 0, lastUpdate: today, icon: '🖊️', desc: '55 字练字只能在周一到周五做' },
      { id: 't2', name: '单词', basePoints: 6, bonusPoints: 0, dailyCount: 0, lastUpdate: today, icon: '📖', desc: '百词斩打卡' },
      { id: 't3', name: '口算', basePoints: 4, bonusPoints: 2, dailyCount: 0, lastUpdate: today, icon: '🔢', desc: '计算小超市 1 页' },
      { id: 't4', name: '数学题', basePoints: 4, bonusPoints: 2, dailyCount: 0, lastUpdate: today, icon: '📐', desc: '164 练习题' },
      { id: 't5', name: '英语学习', basePoints: 12, bonusPoints: 0, dailyCount: 0, lastUpdate: today, icon: '📺', desc: '满分英语 1 视频 + 练习题' },
      { id: 't6', name: '练字一页（仅周末）', basePoints: 10, bonusPoints: 1, dailyCount: 0, lastUpdate: today, icon: '🐅', desc: '写一页书法只能在休息日做' },
      { id: 't7', name: '英语单词复习 80 词', basePoints: 4, bonusPoints: 0, dailyCount: 0, lastUpdate: today, icon: '🏰', desc: '百词斩填词 80 词' },
      { id: 't8', name: '语文练习卷 1/4 页', basePoints: 8, bonusPoints: 4, dailyCount: 0, lastUpdate: today, icon: '📝', desc: '语文练习卷 1/4 页' },
    ],
    logs: [],
    timers: [],
    config: { dailyExchangeLimitWeekday: 60, dailyExchangeLimitHoliday: 90 },
  }
}

// 跨日时把过期任务的 dailyCount 清零；无需重置则原样返回
export function applyDailyReset(data, today) {
  const needsReset = data.tasks.some((t) => t.lastUpdate !== today)
  if (!needsReset) return data
  return {
    ...data,
    tasks: data.tasks.map((t) =>
      t.lastUpdate !== today ? { ...t, dailyCount: 0, lastUpdate: today } : t
    ),
  }
}

// 完成任务加分
export function earn(data, taskId, isPerfect, today, nowMs) {
  const task = data.tasks.find((t) => t.id === taskId)
  if (!task) throw new OperationError(404, '任务不存在')

  const points = calculatePoints(task, isPerfect)
  const multiplier = getDecayMultiplier(task.dailyCount)
  const newDailyCount = task.dailyCount + 1

  const log = {
    id: `l_${nowMs}`,
    type: 'EARN',
    taskId,
    taskName: task.name,
    pointsChange: points,
    timestamp: nowMs,
    meta: { quality: isPerfect ? 'perfect' : 'normal', decayRate: multiplier, dailyCount: newDailyCount },
  }

  const next = {
    ...data,
    balance: round2(data.balance + points),
    tasks: data.tasks.map((t) =>
      t.id === taskId ? { ...t, dailyCount: newDailyCount, lastUpdate: today } : t
    ),
    logs: [log, ...data.logs],
  }
  return { data: next, result: { points, newBalance: next.balance, dailyCount: newDailyCount } }
}

// 管理员手动调整余额（不为负）
export function adjustBalance(data, amount, nowMs) {
  const log = {
    id: `l_${nowMs}`,
    type: amount >= 0 ? 'EARN' : 'REDEEM',
    taskId: null,
    taskName: '管理员调整',
    pointsChange: amount,
    timestamp: nowMs,
    meta: { admin: true },
  }
  const next = {
    ...data,
    balance: round2(Math.max(0, data.balance + amount)),
    logs: [log, ...data.logs],
  }
  return { data: next, result: { newBalance: next.balance } }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npm test -- operations`
Expected: PASS，全部通过。

- [ ] **Step 5: 提交**

```bash
git add lib/operations.js tests/operations.test.js
git commit -m "feat: 业务操作(一) 默认数据/每日重置/加分/调余额"
```

---

## Task 6: `lib/operations.js`（二）兑换与计时器

**Files:**
- Modify: `lib/operations.js`
- Test: `tests/operations.test.js`

> 兑换逻辑与 `server/server.js` 一致：只校验余额是否足够（每日兑换上限不在服务端强制，维持现状），扣分、记日志、生成计时器。计时器暂停记录 `remainingMs` 并清空 `endTime`；继续时用 `now + remainingMs` 重置 `endTime`。

- [ ] **Step 1: 在 `tests/operations.test.js` 末尾追加测试**

```js
import { redeem, clearExpiredTimers, pauseTimer, resumeTimer } from '../lib/operations.js'

const TIER = { id: 'basic', label: '短途飞行', cost: 10, baseMinutes: 15, totalMinutes: 15 }

describe('redeem', () => {
  it('余额足够时扣分并生成计时器', () => {
    const data = { ...getDefaultData(TODAY), balance: 20 }
    const { data: next, result } = redeem(data, TIER, 1000)
    expect(result.newBalance).toBe(10)
    expect(result.timer.minutes).toBe(15)
    expect(result.timer.endTime).toBe(1000 + 15 * 60 * 1000)
    expect(next.logs[0].type).toBe('REDEEM')
    expect(next.timers).toHaveLength(1)
  })
  it('余额不足抛 400', () => {
    const data = { ...getDefaultData(TODAY), balance: 5 }
    expect(() => redeem(data, TIER, 1000)).toThrow(/积分不足/)
  })
})

describe('timers', () => {
  const base = () => ({
    ...getDefaultData(TODAY),
    timers: [
      { id: 'a', endTime: 5000, label: 'x' },
      { id: 'b', endTime: 50000, label: 'y' },
    ],
  })
  it('clearExpiredTimers 移除已过期', () => {
    const { data: next, result } = clearExpiredTimers(base(), 10000)
    expect(result.removed).toBe(1)
    expect(next.timers.map((t) => t.id)).toEqual(['b'])
  })
  it('pauseTimer 记录剩余并清空 endTime', () => {
    const { data: next } = pauseTimer(base(), 'b', 10000)
    const t = next.timers.find((x) => x.id === 'b')
    expect(t.paused).toBe(true)
    expect(t.remainingMs).toBe(40000)
    expect(t.endTime).toBe(null)
  })
  it('resumeTimer 用 now + remaining 恢复 endTime', () => {
    const paused = pauseTimer(base(), 'b', 10000).data
    const { data: next } = resumeTimer(paused, 'b', 20000)
    const t = next.timers.find((x) => x.id === 'b')
    expect(t.paused).toBe(false)
    expect(t.endTime).toBe(60000)
    expect(t.remainingMs).toBe(null)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test -- operations`
Expected: FAIL，找不到 `redeem` 等导出。

- [ ] **Step 3: 在 `lib/operations.js` 末尾追加实现**

```js
// 兑换积分，生成倒计时计时器
export function redeem(data, tier, nowMs) {
  if (data.balance < tier.cost) throw new OperationError(400, '积分不足')

  const log = {
    id: `l_${nowMs}`,
    type: 'REDEEM',
    taskId: null,
    taskName: tier.label,
    pointsChange: -tier.cost,
    minutes: tier.totalMinutes,
    baseMinutes: tier.baseMinutes,
    timestamp: nowMs,
    meta: { tier: tier.id },
  }
  const timer = {
    id: `timer_${nowMs}`,
    minutes: tier.totalMinutes,
    startTime: nowMs,
    endTime: nowMs + tier.totalMinutes * 60 * 1000,
    label: tier.label,
  }
  const next = {
    ...data,
    balance: round2(data.balance - tier.cost),
    logs: [log, ...data.logs],
    timers: [timer, ...(data.timers || [])],
  }
  return { data: next, result: { newBalance: next.balance, timer } }
}

// 清除已过期计时器
export function clearExpiredTimers(data, nowMs) {
  const timers = data.timers || []
  const kept = timers.filter((t) => t.endTime > nowMs)
  return { data: { ...data, timers: kept }, result: { removed: timers.length - kept.length } }
}

// 暂停计时器
export function pauseTimer(data, timerId, nowMs) {
  const timers = data.timers || []
  const timer = timers.find((t) => t.id === timerId)
  if (!timer || timer.endTime == null || timer.endTime <= nowMs) {
    throw new OperationError(404, '计时器不存在或已过期')
  }
  const updated = { ...timer, remainingMs: timer.endTime - nowMs, paused: true, endTime: null }
  return {
    data: { ...data, timers: timers.map((t) => (t.id === timerId ? updated : t)) },
    result: { timer: updated },
  }
}

// 继续计时器
export function resumeTimer(data, timerId, nowMs) {
  const timers = data.timers || []
  const timer = timers.find((t) => t.id === timerId)
  if (!timer || !timer.paused || !timer.remainingMs) {
    throw new OperationError(404, '计时器不存在或无法继续')
  }
  const updated = { ...timer, endTime: nowMs + timer.remainingMs, paused: false, remainingMs: null }
  return {
    data: { ...data, timers: timers.map((t) => (t.id === timerId ? updated : t)) },
    result: { timer: updated },
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npm test -- operations`
Expected: PASS，全部通过。

- [ ] **Step 5: 提交**

```bash
git add lib/operations.js tests/operations.test.js
git commit -m "feat: 业务操作(二) 兑换与计时器"
```

---

## Task 7: `lib/operations.js`（三）任务增删改

**Files:**
- Modify: `lib/operations.js`
- Test: `tests/operations.test.js`

> 与 `server/server.js` 一致：新增任务 id 为 `t_${nowMs}`，`basePoints` 默认 4、`bonusPoints` 默认 2、`icon` 默认 📝。

- [ ] **Step 1: 在 `tests/operations.test.js` 末尾追加测试**

```js
import { addTask, updateTask, removeTask } from '../lib/operations.js'

describe('task CRUD', () => {
  it('addTask 追加新任务并带默认值', () => {
    const data = getDefaultData(TODAY)
    const { data: next, result } = addTask(data, { name: '阅读' }, TODAY, 999)
    expect(next.tasks).toHaveLength(9)
    expect(result.id).toBe('t_999')
    expect(result.basePoints).toBe(4)
    expect(result.bonusPoints).toBe(2)
    expect(result.lastUpdate).toBe(TODAY)
  })
  it('updateTask 合并字段', () => {
    const data = getDefaultData(TODAY)
    const { data: next, result } = updateTask(data, 't1', { basePoints: 7 })
    expect(result.basePoints).toBe(7)
    expect(next.tasks.find((t) => t.id === 't1').basePoints).toBe(7)
  })
  it('updateTask 任务不存在抛 404', () => {
    expect(() => updateTask(getDefaultData(TODAY), 'nope', {})).toThrow(/不存在/)
  })
  it('removeTask 删除任务', () => {
    const { data: next } = removeTask(getDefaultData(TODAY), 't1')
    expect(next.tasks.find((t) => t.id === 't1')).toBeUndefined()
    expect(next.tasks).toHaveLength(7)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npm test -- operations`
Expected: FAIL，找不到 `addTask` 等导出。

- [ ] **Step 3: 在 `lib/operations.js` 末尾追加实现**

```js
// 新增任务
export function addTask(data, fields, today, nowMs) {
  const name = (fields.name || '').trim()
  const newTask = {
    id: `t_${nowMs}`,
    name,
    basePoints: parseInt(fields.basePoints) || 4,
    bonusPoints: parseInt(fields.bonusPoints) || 2,
    icon: fields.icon || '📝',
    desc: fields.desc || name,
    dailyCount: 0,
    lastUpdate: today,
  }
  return { data: { ...data, tasks: [...data.tasks, newTask] }, result: newTask }
}

// 修改任务配置
export function updateTask(data, taskId, updates) {
  const task = data.tasks.find((t) => t.id === taskId)
  if (!task) throw new OperationError(404, '任务不存在')
  const updated = { ...task, ...updates }
  return {
    data: { ...data, tasks: data.tasks.map((t) => (t.id === taskId ? updated : t)) },
    result: updated,
  }
}

// 删除任务
export function removeTask(data, taskId) {
  return { data: { ...data, tasks: data.tasks.filter((t) => t.id !== taskId) }, result: { taskId } }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npm test -- operations`
Expected: PASS，全部通过。

- [ ] **Step 5: 提交**

```bash
git add lib/operations.js tests/operations.test.js
git commit -m "feat: 业务操作(三) 任务增删改"
```

---

## Task 8: `lib/db.js` + `lib/ratelimit.js`（Redis 接入）

**Files:**
- Create: `lib/db.js`
- Create: `lib/ratelimit.js`
- Modify: `package.json`（加 `@upstash/redis`）

> 这两个模块是与 Redis 的薄胶水层，依赖运行时环境变量，不写单元测试（其内部逻辑 `applyDailyReset` 已在 Task 5 测过）；通过后续 Vercel Preview 冒烟验证。

- [ ] **Step 1: 安装 Upstash Redis SDK**

Run:
```bash
npm install @upstash/redis
```

- [ ] **Step 2: 创建 `lib/db.js`**

```js
import { Redis } from '@upstash/redis'
import { getBeijingDateStr } from './time.js'
import { getDefaultData, applyDailyReset } from './operations.js'

const KEY = 'timebank:data'

// 从环境变量读取 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
export const redis = Redis.fromEnv()

// 读取全部数据，并按北京日期做懒惰每日重置
export async function readData() {
  const today = getBeijingDateStr()
  let data = await redis.get(KEY) // @upstash/redis 自动反序列化 JSON
  if (!data) {
    data = getDefaultData(today)
    await redis.set(KEY, data)
    return data
  }
  const reset = applyDailyReset(data, today)
  if (reset !== data) await redis.set(KEY, reset)
  return reset
}

// 覆盖保存全部数据
export async function saveData(data) {
  await redis.set(KEY, data)
  return data
}
```

- [ ] **Step 3: 创建 `lib/ratelimit.js`**

```js
import { redis } from './db.js'

const MAX_FAILS = 5
const WINDOW_SEC = 10 * 60 // 10 分钟

// 是否允许尝试登录
export async function checkLoginRate(ip) {
  const fails = await redis.get(`login:fail:${ip}`)
  return { allowed: !fails || Number(fails) < MAX_FAILS }
}

// 记录一次失败
export async function recordLoginFail(ip) {
  const key = `login:fail:${ip}`
  const n = await redis.incr(key)
  if (n === 1) await redis.expire(key, WINDOW_SEC)
}

// 登录成功后清除失败计数
export async function resetLoginRate(ip) {
  await redis.del(`login:fail:${ip}`)
}
```

- [ ] **Step 4: 运行全部已有测试，确认未破坏**

Run: `npm test`
Expected: PASS，Task 2–7 的测试全部通过（db/ratelimit 无测试，不影响）。

- [ ] **Step 5: 提交**

```bash
git add lib/db.js lib/ratelimit.js package.json package-lock.json
git commit -m "feat: 接入 Upstash Redis 数据层与登录限流"
```

---

## Task 9: 登录 / 登出 / 会话检查接口

**Files:**
- Create: `api/login.js`
- Create: `api/logout.js`
- Create: `api/session.js`

- [ ] **Step 1: 创建 `api/login.js`**

```js
import crypto from 'node:crypto'
import { signSession, buildSessionCookie, SESSION_TTL_MS } from '../lib/auth.js'
import { checkLoginRate, recordLoginFail, resetLoginRate } from '../lib/ratelimit.js'

function safeEqual(a, b) {
  const ab = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms))

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'
  const gate = await checkLoginRate(ip)
  if (!gate.allowed) return res.status(429).json({ error: '尝试过于频繁，请稍后再试' })

  const password = req.body?.password ?? ''
  const expected = process.env.APP_PASSWORD ?? ''
  const ok = expected.length > 0 && safeEqual(password, expected)

  if (!ok) {
    await recordLoginFail(ip)
    await delay(500) // 失败固定延迟，削弱暴力破解
    return res.status(401).json({ error: '密码错误' })
  }

  await resetLoginRate(ip)
  const token = signSession(process.env.SESSION_SECRET, Date.now() + SESSION_TTL_MS)
  res.setHeader('Set-Cookie', buildSessionCookie(token))
  return res.status(200).json({ success: true })
}
```

- [ ] **Step 2: 创建 `api/logout.js`**

```js
import { clearSessionCookie } from '../lib/auth.js'

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  res.setHeader('Set-Cookie', clearSessionCookie())
  return res.status(200).json({ success: true })
}
```

- [ ] **Step 3: 创建 `api/session.js`**

```js
import { requireAuth } from '../lib/auth.js'

// 仅用于前端 AuthGate 启动时判断是否已登录
export default function handler(req, res) {
  if (!requireAuth(req, res)) return
  return res.status(200).json({ authed: true })
}
```

- [ ] **Step 4: 运行测试确认 lib 仍通过（接口将在部署后冒烟验证）**

Run: `npm test`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add api/login.js api/logout.js api/session.js
git commit -m "feat: 登录/登出/会话检查接口"
```

---

## Task 10: 数据读写接口 `api/data.js`

**Files:**
- Create: `api/data.js`

- [ ] **Step 1: 创建 `api/data.js`**

```js
import { requireAuth } from '../lib/auth.js'
import { readData, saveData } from '../lib/db.js'

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return

  if (req.method === 'GET') {
    const data = await readData()
    return res.status(200).json(data)
  }
  if (req.method === 'POST') {
    await saveData(req.body)
    return res.status(200).json({ success: true, message: '数据已保存' })
  }
  return res.status(405).json({ error: 'Method Not Allowed' })
}
```

- [ ] **Step 2: 提交**

```bash
git add api/data.js
git commit -m "feat: 数据读写接口 api/data.js"
```

---

## Task 11: 加分 / 兑换 / 调余额接口

**Files:**
- Create: `api/earn.js`
- Create: `api/redeem.js`
- Create: `api/balance.js`

- [ ] **Step 1: 创建 `api/earn.js`**

```js
import { requireAuth } from '../lib/auth.js'
import { readData, saveData } from '../lib/db.js'
import { earn } from '../lib/operations.js'
import { getBeijingDateStr } from '../lib/time.js'

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  try {
    const { taskId, isPerfect } = req.body || {}
    const now = Date.now()
    const data = await readData()
    const { data: next, result } = earn(data, taskId, isPerfect, getBeijingDateStr(new Date(now)), now)
    await saveData(next)
    return res.status(200).json({ success: true, ...result })
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message })
  }
}
```

- [ ] **Step 2: 创建 `api/redeem.js`**

```js
import { requireAuth } from '../lib/auth.js'
import { readData, saveData } from '../lib/db.js'
import { redeem } from '../lib/operations.js'

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  try {
    const { tier } = req.body || {}
    const data = await readData()
    const { data: next, result } = redeem(data, tier, Date.now())
    await saveData(next)
    return res.status(200).json({ success: true, ...result })
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message })
  }
}
```

- [ ] **Step 3: 创建 `api/balance.js`**

```js
import { requireAuth } from '../lib/auth.js'
import { readData, saveData } from '../lib/db.js'
import { adjustBalance } from '../lib/operations.js'

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  try {
    const { amount } = req.body || {}
    const data = await readData()
    const { data: next, result } = adjustBalance(data, amount, Date.now())
    await saveData(next)
    return res.status(200).json({ success: true, ...result })
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message })
  }
}
```

- [ ] **Step 4: 提交**

```bash
git add api/earn.js api/redeem.js api/balance.js
git commit -m "feat: 加分/兑换/调余额接口"
```

---

## Task 12: 任务接口（新增 / 改 / 删）

**Files:**
- Create: `api/tasks/index.js`
- Create: `api/tasks/[taskId].js`

> Vercel 动态路由：`api/tasks/[taskId].js` 通过 `req.query.taskId` 取得路径参数。

- [ ] **Step 1: 创建 `api/tasks/index.js`**

```js
import { requireAuth } from '../../lib/auth.js'
import { readData, saveData } from '../../lib/db.js'
import { addTask } from '../../lib/operations.js'
import { getBeijingDateStr } from '../../lib/time.js'

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  try {
    const now = Date.now()
    const data = await readData()
    const { data: next, result } = addTask(data, req.body || {}, getBeijingDateStr(new Date(now)), now)
    await saveData(next)
    return res.status(200).json({ success: true, task: result })
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message })
  }
}
```

- [ ] **Step 2: 创建 `api/tasks/[taskId].js`**

```js
import { requireAuth } from '../../lib/auth.js'
import { readData, saveData } from '../../lib/db.js'
import { updateTask, removeTask } from '../../lib/operations.js'

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return
  const { taskId } = req.query
  try {
    const data = await readData()
    if (req.method === 'PUT') {
      const { data: next, result } = updateTask(data, taskId, req.body || {})
      await saveData(next)
      return res.status(200).json({ success: true, task: result })
    }
    if (req.method === 'DELETE') {
      const { data: next } = removeTask(data, taskId)
      await saveData(next)
      return res.status(200).json({ success: true })
    }
    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message })
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add api/tasks/index.js "api/tasks/[taskId].js"
git commit -m "feat: 任务新增/修改/删除接口"
```

---

## Task 13: 计时器接口（清理 / 暂停 / 继续）

**Files:**
- Create: `api/timers/clear.js`
- Create: `api/timers/[timerId].js`

> 暂停/继续合并到一个动态路由，用请求体 `action`（`'pause'` / `'resume'`）区分。前端将相应调整（Task 14）。

- [ ] **Step 1: 创建 `api/timers/clear.js`**

```js
import { requireAuth } from '../../lib/auth.js'
import { readData, saveData } from '../../lib/db.js'
import { clearExpiredTimers } from '../../lib/operations.js'

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  const data = await readData()
  const { data: next, result } = clearExpiredTimers(data, Date.now())
  await saveData(next)
  return res.status(200).json({ success: true, removed: result.removed })
}
```

- [ ] **Step 2: 创建 `api/timers/[timerId].js`**

```js
import { requireAuth } from '../../lib/auth.js'
import { readData, saveData } from '../../lib/db.js'
import { pauseTimer, resumeTimer } from '../../lib/operations.js'

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  const { timerId } = req.query
  const { action } = req.body || {}
  try {
    const data = await readData()
    const op = action === 'resume' ? resumeTimer : action === 'pause' ? pauseTimer : null
    if (!op) return res.status(400).json({ error: '未知操作' })
    const { data: next, result } = op(data, timerId, Date.now())
    await saveData(next)
    return res.status(200).json({ success: true, timer: result.timer })
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message })
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add api/timers/clear.js "api/timers/[timerId].js"
git commit -m "feat: 计时器清理/暂停/继续接口"
```

---

## Task 14: 前端 `store.js` 改造（相对路径 / Cookie / 401 / 暂停继续）

**Files:**
- Modify: `src/store.js`

> 改动点：①`API_BASE` 改成 `/api`；②所有请求加 `credentials: 'include'` 携带 Cookie；③收到 401 时刷新页面回到登录；④暂停/继续改为 `POST /api/timers/{id}` 带 `{ action }`。其余业务方法签名与行为不变。

- [ ] **Step 1: 替换 `src/store.js` 顶部的 `API_BASE` 与 `api` 对象**

把文件开头到 `const useStore = create(...)` 之前的 `API_BASE` 常量与 `const api = {...}` 整段替换为：

```js
import { create } from 'zustand';
import { calculatePoints, getDecayRate, getTodayStr, DEFAULT_TASKS } from './engine';

const API_BASE = '/api';

// 统一 fetch：携带 Cookie；遇 401 跳回登录页
const request = async (path, options = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    if (res.status === 401) {
        // 会话失效：刷新页面，AuthGate 会重新要求登录
        window.location.reload();
        throw new Error('未授权');
    }
    return res;
};

const api = {
    getData: async () => {
        const res = await request('/data');
        return await res.json();
    },

    saveData: async (data) => {
        const res = await request('/data', { method: 'POST', body: JSON.stringify(data) });
        return await res.json();
    },

    earnPoints: async (taskId, isPerfect) => {
        const res = await request('/earn', { method: 'POST', body: JSON.stringify({ taskId, isPerfect }) });
        return await res.json();
    },

    redeemPoints: async (tier) => {
        const res = await request('/redeem', { method: 'POST', body: JSON.stringify({ tier }) });
        return await res.json();
    },

    clearExpiredTimers: async () => {
        const res = await request('/timers/clear', { method: 'POST' });
        return await res.json();
    },

    pauseTimer: async (timerId) => {
        const res = await request(`/timers/${timerId}`, { method: 'POST', body: JSON.stringify({ action: 'pause' }) });
        return await res.json();
    },

    resumeTimer: async (timerId) => {
        const res = await request(`/timers/${timerId}`, { method: 'POST', body: JSON.stringify({ action: 'resume' }) });
        return await res.json();
    },

    updateTask: async (taskId, updates) => {
        const res = await request(`/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(updates) });
        return await res.json();
    },

    addTask: async (task) => {
        const res = await request('/tasks', { method: 'POST', body: JSON.stringify(task) });
        return await res.json();
    },

    removeTask: async (taskId) => {
        const res = await request(`/tasks/${taskId}`, { method: 'DELETE' });
        return await res.json();
    },

    adjustBalance: async (amount) => {
        const res = await request('/balance', { method: 'POST', body: JSON.stringify({ amount }) });
        return await res.json();
    },
};
```

- [ ] **Step 2: 确认 `useStore` 中的业务方法无需改动**

`useStore` 内部调用的都是 `api.xxx(...)`，签名未变；`adjustBalance` 接口路径从 `/balance/adjust` 变为 `/balance`，已在上面 `api.adjustBalance` 内处理。无需改 store 其余部分。

- [ ] **Step 3: 构建确认无语法错误**

Run: `npm run build`
Expected: 构建成功，无报错。

- [ ] **Step 4: 提交**

```bash
git add src/store.js
git commit -m "refactor: store 改用相对 API、携带 Cookie、处理 401"
```

---

## Task 15: 登录页与 AuthGate

**Files:**
- Create: `src/components/LoginPage.jsx`
- Create: `src/components/AuthGate.jsx`
- Modify: `src/main.jsx`

- [ ] **Step 1: 创建 `src/components/LoginPage.jsx`**

```jsx
import { useState } from 'react';

export default function LoginPage({ onSuccess }) {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password }),
            });
            if (res.ok) {
                onSuccess();
            } else if (res.status === 429) {
                setError('尝试过于频繁，请稍后再试');
            } else {
                setError('密码错误');
            }
        } catch {
            setError('网络错误，请重试');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-dvh flex flex-col items-center justify-center px-6">
            <div className="text-5xl mb-4">✈️</div>
            <h1 className="comic-title text-sky text-2xl tracking-wider mb-6">TIMEBANK</h1>
            <form onSubmit={submit} className="w-full max-w-xs flex flex-col gap-3">
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    autoFocus
                    className="w-full rounded-xl px-4 py-3 bg-white/10 text-cloud text-center text-lg outline-none focus:ring-2 focus:ring-sky"
                />
                {error && <p className="text-red text-sm text-center">{error}</p>}
                <button type="submit" className="btn-primary w-full" disabled={loading || !password}>
                    {loading ? '登录中…' : '进入'}
                </button>
            </form>
        </div>
    );
}
```

- [ ] **Step 2: 创建 `src/components/AuthGate.jsx`**

```jsx
import { useState, useEffect } from 'react';
import LoginPage from './LoginPage';

export default function AuthGate({ children }) {
    const [status, setStatus] = useState('checking'); // checking | authed | anon

    useEffect(() => {
        fetch('/api/session', { credentials: 'include' })
            .then((r) => setStatus(r.ok ? 'authed' : 'anon'))
            .catch(() => setStatus('anon'));
    }, []);

    if (status === 'checking') {
        return (
            <div className="min-h-dvh flex flex-col items-center justify-center">
                <div className="text-6xl mb-4 animate-bounce">✈️</div>
                <p className="text-cloud text-lg font-bold">正在加载…</p>
            </div>
        );
    }
    if (status === 'anon') {
        return <LoginPage onSuccess={() => setStatus('authed')} />;
    }
    return children;
}
```

- [ ] **Step 3: 修改 `src/main.jsx` 用 AuthGate 包裹 App**

把 `src/main.jsx` 整体替换为：

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import AuthGate from './components/AuthGate.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthGate>
        <App />
      </AuthGate>
    </BrowserRouter>
  </React.StrictMode>
)
```

- [ ] **Step 4: 构建确认无错误**

Run: `npm run build`
Expected: 构建成功。

- [ ] **Step 5: 提交**

```bash
git add src/components/LoginPage.jsx src/components/AuthGate.jsx src/main.jsx
git commit -m "feat: 登录页与 AuthGate 守卫"
```

---

## Task 16: 部署配置（vercel.json / 环境变量示例 / gitignore）

**Files:**
- Create: `vercel.json`
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: 创建 `vercel.json`（SPA 回退，排除 /api）**

```json
{
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

> 说明：Vercel 先匹配 `/api/*` 函数与已存在的静态资源，未命中的前端路由（如 `/analytics`）回退到 `index.html`，支持 React Router 客户端路由。

- [ ] **Step 2: 创建 `.env.example`**

```bash
# 登录密码（自定义，越长越好）
APP_PASSWORD=请改成你的密码

# 会话签名密钥（随机长字符串，可用：openssl rand -base64 32）
SESSION_SECRET=请改成一段随机字符串

# Upstash Redis（在 Upstash 控制台或 Vercel 集成里自动获得）
UPSTASH_REDIS_REST_URL=https://xxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxxxxxxx
```

- [ ] **Step 3: 修改 `.gitignore` 追加忽略项**

在 `.gitignore` 末尾追加：
```
.env
.env*.local
.vercel
```

> 注意：`.env.example` 不带敏感值，应保留在 git 中（不要忽略）。

- [ ] **Step 4: 提交**

```bash
git add vercel.json .env.example .gitignore
git commit -m "chore: Vercel 部署配置与环境变量示例"
```

---

## Task 17: 数据迁移脚本

**Files:**
- Create: `scripts/migrate-from-lan.mjs`

> 从老服务器（默认 `http://192.168.2.105:3001/api/data`）抓取最新数据，写入 Upstash 的 `timebank:data`。运行前需在环境里设置 `UPSTASH_REDIS_REST_URL` 与 `UPSTASH_REDIS_REST_TOKEN`，且运行机器能访问局域网老服务器。

- [ ] **Step 1: 创建 `scripts/migrate-from-lan.mjs`**

```js
// 用法：
//   UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... \
//   node scripts/migrate-from-lan.mjs [老服务器data接口URL]
import { Redis } from '@upstash/redis'

const LAN_URL = process.argv[2] || 'http://192.168.2.105:3001/api/data'
const KEY = 'timebank:data'

const redis = Redis.fromEnv()

console.log(`📡 正在从老服务器抓取数据：${LAN_URL}`)
const res = await fetch(LAN_URL)
if (!res.ok) {
  console.error(`❌ 抓取失败，HTTP ${res.status}`)
  process.exit(1)
}
const data = await res.json()

await redis.set(KEY, data)
console.log('✅ 已导入 Upstash:', {
  balance: data.balance,
  tasks: Array.isArray(data.tasks) ? data.tasks.length : 0,
  logs: Array.isArray(data.logs) ? data.logs.length : 0,
  timers: Array.isArray(data.timers) ? data.timers.length : 0,
})
```

- [ ] **Step 2: 静态检查脚本可被 Node 解析**

Run: `node --check scripts/migrate-from-lan.mjs`
Expected: 无输出（语法正确）。

> 真正执行迁移放到部署阶段（见 `docs/DEPLOY.md`），此处不连真实 Redis。

- [ ] **Step 3: 提交**

```bash
git add scripts/migrate-from-lan.mjs
git commit -m "feat: 老服务器数据迁移脚本"
```

---

## Task 18: 用户部署指南 `docs/DEPLOY.md`

**Files:**
- Create: `docs/DEPLOY.md`

- [ ] **Step 1: 创建 `docs/DEPLOY.md`**

```markdown
# TimeBank 部署到 Vercel 指南

## 一、注册账号（都免费）
1. 注册 [Vercel](https://vercel.com)（用 GitHub 登录最方便）。
2. 注册 [Upstash](https://upstash.com)，创建一个 **Redis** 数据库（地区选离你近的，如 `ap-` 亚太）。

## 二、拿到 Upstash 连接信息
在 Upstash 数据库详情页，找到 **REST API** 区块，复制：
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

## 三、在 Vercel 导入项目并配置环境变量
1. Vercel → Add New → Project → 选择本仓库（GitHub）。
2. 进入 Project Settings → Environment Variables，添加 4 个变量（Production 和 Preview 都勾）：
   - `APP_PASSWORD`：你的登录密码
   - `SESSION_SECRET`：随机字符串（终端运行 `openssl rand -base64 32` 生成）
   - `UPSTASH_REDIS_REST_URL`：上一步复制的 URL
   - `UPSTASH_REDIS_REST_TOKEN`：上一步复制的 Token
3. 点 Deploy，等待部署完成，得到公网网址（如 `https://timebank-xxx.vercel.app`）。

## 四、迁移老数据（一次性）
在一台能访问局域网老服务器（192.168.2.105）的电脑上，于项目目录运行：

\`\`\`bash
npm install
UPSTASH_REDIS_REST_URL="刚才的URL" \
UPSTASH_REDIS_REST_TOKEN="刚才的TOKEN" \
node scripts/migrate-from-lan.mjs
\`\`\`

看到 `✅ 已导入 Upstash` 即成功。若老服务器 API 不可达，可改用 SSH 取回 `server/data/timebank-data.json` 后，把脚本里的 `fetch` 换成读取该文件（或临时 `node -e` 读文件再 `redis.set`）。

## 五、验收（对照 spec 的验收标准）
1. 打开公网网址 → 应弹出登录页。
2. 输错密码进不去；输对密码进入，数据（余额/任务/记录）与老服务器一致。
3. 浏览器无痕窗口直接访问 `https://你的网址/api/data` → 应返回 `{"error":"未授权"}`（401）。
4. 走一遍：加分、兑换、计时暂停/继续、管理员加减分、增删改任务、查看图表。
5. 跨日观察任务次数是否在北京午夜清零。

## 六、退役老服务器
以上全部通过、稳定使用几天后，再关停 192.168.2.105 上的老服务（保留数据文件作离线备份）。

## 修改密码
改 Vercel 环境变量 `APP_PASSWORD` → 重新 Deploy 即可。
```

- [ ] **Step 2: 提交**

```bash
git add docs/DEPLOY.md
git commit -m "docs: 添加 Vercel 部署与迁移指南"
```

---

## 最终验证（全部任务完成后）

- [ ] **运行完整测试套件**

Run: `npm test`
Expected: 所有 lib 单元测试通过。

- [ ] **生产构建**

Run: `npm run build`
Expected: 构建成功，生成 `dist/`。

- [ ] **按 `docs/DEPLOY.md` 部署到 Vercel 并完成"验收清单"** —— 这是真正确认门禁与功能的步骤（接口层与前端在此处端到端验证）。

- [ ] **验收通过后**，参照 superpowers:finishing-a-development-branch 决定合并/PR/收尾，并提醒用户稳定运行几天后再退役老服务器。
