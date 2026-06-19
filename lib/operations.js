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
    config: { dailyExchangeLimitWeekday: 360, dailyExchangeLimitHoliday: 360, notifyOnExpire: true },
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
  // 暂停中的计时器 (endTime 为 null) 不算过期，保留
  const kept = timers.filter((t) => t.paused || t.endTime > nowMs)
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

// 给指定计时器写入/清除 QStash 调度 id（纯函数）
export function setTimerSchedule(data, timerId, scheduleId) {
  return {
    ...data,
    timers: (data.timers || []).map((t) =>
      t.id === timerId ? { ...t, scheduleId } : t
    ),
  }
}
