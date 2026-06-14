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
