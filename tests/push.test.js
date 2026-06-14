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
