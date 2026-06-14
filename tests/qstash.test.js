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
