import { describe, it, expect } from 'vitest'
import { pickNewlyExpired, mostRecentArrived } from '../src/utils/timerChime.js'

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
