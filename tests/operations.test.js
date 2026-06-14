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
