# 到站提醒优化（已读/未读模型）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让前台到站提醒只在"前台实时到站"或"后台/隐藏期间到点的未读消息回到前台时"播报，且每次只弹最近一个；进入页面不再播报历史 backlog，已读项不重播。

**Architecture:** 用一个持久化的"已读集合"`seenRef`（`localStorage`）+ 一个一次性初始化标记静默消化历史 backlog；统一的 `announceArrivals()` 仅在页面可见时把"未读且已到站"的计时器标记已读并弹最近一个（声音播一遍），由 `setTimeout`（实时到站）、`visibilitychange`/`focus`（回前台补响）、挂载与列表变化触发。

**Tech Stack:** React 19 hooks、Vite、vitest（node 环境，纯函数单测）。

依据 spec：`docs/superpowers/specs/2026-06-14-arrival-chime-read-unread-design.md`（已确认）。当前分支 `feat/arrival-chime-read-unread`。

---

## 文件结构

- `src/utils/timerChime.js`（改）：保留 `pickNewlyExpired`；**新增**纯函数 `mostRecentArrived(timers, ids)`。
- `tests/timerChime.test.js`（改）：新增 `mostRecentArrived` 单测。
- `src/hooks/useTimerChime.js`（重写）：已读/未读模型 + `announceArrivals` + 返回 `{ lastArrived, dismiss }`（取代 `{ arrivedCount, dismiss }`）。
- `src/App.jsx`（改）：横幅改用 `lastArrived`（显示名字）。

后端 / PWA / Service Worker / 推送：**不动**。

---

## Task 1: 新增纯函数 `mostRecentArrived`（TDD）

**Files:**
- Modify: `src/utils/timerChime.js`
- Test: `tests/timerChime.test.js`

- [ ] **Step 1: 追加失败测试**

在 `tests/timerChime.test.js` 顶部的 import 改为同时引入两个函数：
```js
import { pickNewlyExpired, mostRecentArrived } from '../src/utils/timerChime.js'
```
在文件**末尾**追加：
```js
describe('mostRecentArrived', () => {
  const ts = [
    { id: 'a', endTime: 1000, label: 'A' },
    { id: 'b', endTime: 3000, label: 'B' },
    { id: 'c', endTime: 2000, label: 'C' },
  ]
  it('在给定 id 中取 endTime 最大的，返回 {id,label}', () => {
    expect(mostRecentArrived(ts, ['a', 'c'])).toEqual({ id: 'c', label: 'C' })
    expect(mostRecentArrived(ts, ['a', 'b', 'c'])).toEqual({ id: 'b', label: 'B' })
  })
  it('ids 为空返回 null', () => {
    expect(mostRecentArrived(ts, [])).toBe(null)
  })
  it('ids 不在 timers 中返回 null', () => {
    expect(mostRecentArrived(ts, ['x'])).toBe(null)
  })
  it('支持 Set 形式的 ids', () => {
    expect(mostRecentArrived(ts, new Set(['a']))).toEqual({ id: 'a', label: 'A' })
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run tests/timerChime.test.js`
Expected: FAIL（`mostRecentArrived is not a function`）；原有 `pickNewlyExpired` 用例仍通过。

- [ ] **Step 3: 实现**

在 `src/utils/timerChime.js` **末尾**追加：
```js
// 在 id ∈ ids 的计时器中，返回到站时间（endTime）最新的一个 {id, label}；ids 为空或无匹配返回 null（纯函数）
export function mostRecentArrived(timers, ids) {
  const idSet = ids instanceof Set ? ids : new Set(ids || [])
  let best = null
  for (const t of timers || []) {
    if (!idSet.has(t.id)) continue
    if (best === null || (t.endTime ?? 0) > (best.endTime ?? 0)) best = t
  }
  return best ? { id: best.id, label: best.label } : null
}
```

- [ ] **Step 4: 运行确认通过**

Run: `npx vitest run tests/timerChime.test.js`
Expected: PASS（含原有用例）。再跑 `npm test` 确认无回归。

- [ ] **Step 5: 提交**

```bash
git add src/utils/timerChime.js tests/timerChime.test.js
git commit -m "feat: mostRecentArrived 纯函数（取最近到站项）"
```

---

## Task 2: 重写 `useTimerChime` 并接入 `App.jsx`

> 一次提交完成 Hook 重写 + 横幅改动，避免中间出现 `arrivedCount` 已删但 App 仍引用导致构建失败。

**Files:**
- Modify: `src/hooks/useTimerChime.js`（整文件替换）
- Modify: `src/App.jsx`（两处）

- [ ] **Step 1: 用以下完整内容替换 `src/hooks/useTimerChime.js`**

```js
import { useEffect, useRef, useState } from 'react'
import { pickNewlyExpired, mostRecentArrived } from '../utils/timerChime'
import { playArrivalSound, stopArrivalSound, unlockArrivalSound } from '../utils/arrivalSound'

const SEEN_KEY = 'timebank-chimed-timers'   // 已读集合（沿用旧 key）
const INIT_KEY = 'timebank-chime-initialized' // 是否已静默消化过历史 backlog

function loadSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')) } catch { return new Set() }
}
function saveSeen(set) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...set])) } catch { /* 忽略 */ }
}

export default function useTimerChime(timers) {
  const seenRef = useRef(loadSeen())
  const timeoutsRef = useRef(new Map())
  const seededRef = useRef(false) // 本组件生命周期内只 seed 一次（防止列表变化时把新到站当 backlog 静默）
  const [lastArrived, setLastArrived] = useState(null)

  // 首个用户手势解锁音频
  useEffect(() => {
    const onGesture = () => { unlockArrivalSound() }
    window.addEventListener('pointerdown', onGesture, { once: true })
    return () => window.removeEventListener('pointerdown', onGesture)
  }, [])

  // 首次加载静默消化历史 backlog（每个客户端一次）：把当时所有"已到站"的计时器标记已读，不响不弹
  const seedBacklogOnce = (list) => {
    if (seededRef.current) return
    seededRef.current = true
    try { if (localStorage.getItem(INIT_KEY)) return } catch { /* 忽略，继续 seed */ }
    const expiredIds = pickNewlyExpired(list, seenRef.current, Date.now())
    expiredIds.forEach((id) => seenRef.current.add(id))
    if (expiredIds.length) saveSeen(seenRef.current)
    try { localStorage.setItem(INIT_KEY, '1') } catch { /* 忽略 */ }
  }

  // 播报：仅前台可见时，把未读已到站项全部标记已读，并弹最近一个、播一遍声音
  const announceArrivals = (list) => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    const ids = pickNewlyExpired(list, seenRef.current, Date.now())
    if (!ids.length) return
    ids.forEach((id) => seenRef.current.add(id))
    saveSeen(seenRef.current)
    const latest = mostRecentArrived(list, ids)
    if (latest) setLastArrived(latest)
    playArrivalSound()
  }

  // 主效果：seed backlog（仅首次）→ 补响未读（可见才响）→ 为未来计时器设精确 setTimeout → 修剪集合
  useEffect(() => {
    seedBacklogOnce(timers)
    announceArrivals(timers)

    timeoutsRef.current.forEach((h) => clearTimeout(h))
    timeoutsRef.current.clear()
    const now = Date.now()
    ;(timers || []).forEach((t) => {
      if (t.paused || t.endTime == null) return
      const delay = t.endTime - now
      if (delay <= 0 || seenRef.current.has(t.id)) return
      const h = setTimeout(() => announceArrivals(timers), delay)
      timeoutsRef.current.set(t.id, h)
    })

    // 修剪已不存在的 id，避免 localStorage 无限增长
    const present = new Set((timers || []).map((t) => t.id))
    let changed = false
    seenRef.current.forEach((id) => { if (!present.has(id)) { seenRef.current.delete(id); changed = true } })
    if (changed) saveSeen(seenRef.current)

    return () => {
      timeoutsRef.current.forEach((h) => clearTimeout(h))
      timeoutsRef.current.clear()
    }
  }, [timers])

  // 回到前台补响离开期间到站的未读项
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') announceArrivals(timers)
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [timers])

  const dismiss = () => { stopArrivalSound(); setLastArrived(null) }
  return { lastArrived, dismiss }
}
```

- [ ] **Step 2: 改 `src/App.jsx` 的 Hook 解构**

把：
```js
    const { arrivedCount, dismiss } = useTimerChime(timers);
```
改为：
```js
    const { lastArrived, dismiss } = useTimerChime(timers);
```

- [ ] **Step 3: 改 `src/App.jsx` 的到站横幅**

把现有横幅块：
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
改为：
```jsx
            {/* ===== 到站提示横幅 ===== */}
            {lastArrived && (
                <button
                    onClick={dismiss}
                    className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] bg-sunset text-white font-bold text-sm px-5 py-2.5 rounded-full shadow-lg animate-bounce"
                    style={{ maxWidth: '90vw' }}
                >
                    ✈️『{lastArrived.label}』到站啦 · 点此停止
                </button>
            )}
```

- [ ] **Step 4: 验证语法、测试与构建**

Run:
```bash
node --check src/hooks/useTimerChime.js
npm test 2>&1 | grep -E "Tests "
npm run build 2>&1 | tail -2
```
Expected: `node --check` 无输出（通过）；测试全过；构建成功（`✓ built`）。

- [ ] **Step 5: dev 手动验证**

Run: `npm run dev`，登录后：
1. **实时到站**：兑换 1 分钟计时，停在"任务"tab（非计时页）→ 到点响一次 + 顶部横幅「✈️『…』到站啦 · 点此停止」，点横幅即停、横幅消失。
2. **后台/隐藏补响**：兑换一个短计时 → 切到别的浏览器标签 → 到点后切回 → 补响一次（最近一个）。
3. **历史 backlog 静默**：在已有多个"已到站"记录的情况下刷新/重进页面 → **无声、无横幅**。
4. **不重播**：让某计时器响过（或点掉）后刷新页面 → 不再响。

Expected: 四项均符合。

- [ ] **Step 6: 提交**

```bash
git add src/hooks/useTimerChime.js src/App.jsx
git commit -m "feat: 到站提醒改为已读/未读模型，只弹最近一个、不再播报历史 backlog"
```

---

## Task 3: 最终验证与收尾

**Files:** 无（验证）

- [ ] **Step 1: 全量测试**

Run: `npm test`
Expected: 全部 PASS（含 `mostRecentArrived` 新用例）。

- [ ] **Step 2: 构建检查**

Run: `npm run build`
Expected: 构建成功。

- [ ] **Step 3: 完成开发分支**

REQUIRED SUB-SKILL: 用 superpowers:finishing-a-development-branch 决定合并/PR/部署（本仓库部署用 `npx vercel --prod --yes`；此改动不涉及新增 Serverless Function，无 12 函数上限风险）。

---

## 自检清单（写计划后回看）

- **spec 覆盖**：§3 已读/未读 + 一次性 backlog 消化 → Task 2（`seedBacklogOnce` + `INIT_KEY`）；§4 `announceArrivals` 与触发时机 → Task 2；§5 只弹最近一个 → Task 1（`mostRecentArrived`）+ Task 2 横幅；§6 状态/修剪 → Task 2；§7 纯函数 → Task 1；§8 影响范围 → 仅 3 文件；§10 测试 → Task 1、Task 2 Step 5、Task 3。✅
- **占位符**：无 TBD/TODO，代码步骤均为完整代码。✅
- **命名一致**：`seenRef`/`seedBacklogOnce`/`announceArrivals`/`mostRecentArrived`/`pickNewlyExpired`/`lastArrived`/`SEEN_KEY`/`INIT_KEY` 在定义与引用处一致；Hook 返回值由 `arrivedCount` → `lastArrived` 同步改了 `App.jsx`。✅
- **构建安全**：Hook 返回值改名与 App.jsx 引用在同一提交（Task 2），不会出现中间构建失败。✅
