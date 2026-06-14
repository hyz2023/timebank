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
    expect(result.points).toBe(4)
    expect(result.newBalance).toBe(4)
    expect(result.dailyCount).toBe(1)
    expect(next.logs[0].type).toBe('EARN')
    expect(next.logs[0].pointsChange).toBe(4)
    expect(data.balance).toBe(0)
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
