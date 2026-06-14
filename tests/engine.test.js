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
