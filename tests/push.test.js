import { describe, it, expect } from 'vitest'
import { upsertSubscription, removeEndpoints, buildPushPayload, shouldFire } from '../lib/push.js'

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

describe('buildPushPayload', () => {
  it('含标题、标签与计时器名', () => {
    const p = buildPushPayload({ id: 'timer_1', label: '短途飞行' })
    expect(p.title).toContain('到站')
    expect(p.tag).toBe('timer_1')
    expect(p.body).toContain('短途飞行')
    expect(p.url).toBe('/?tab=timer')
  })
})

describe('shouldFire', () => {
  const data = (timers, cfg) => ({ timers, config: { notifyOnExpire: true, ...cfg } })
  it('到点且未暂停 → true', () => {
    expect(shouldFire(data([{ id: 't', endTime: 1000 }]), 't', 1000)).toBe(true)
  })
  it('计时器不存在（已清除）→ false', () => {
    expect(shouldFire(data([]), 't', 1000)).toBe(false)
  })
  it('已暂停 → false', () => {
    expect(shouldFire(data([{ id: 't', endTime: null, paused: true }]), 't', 9999)).toBe(false)
  })
  it('notifyOnExpire=false → false', () => {
    expect(shouldFire(data([{ id: 't', endTime: 1000 }], { notifyOnExpire: false }), 't', 1000)).toBe(false)
  })
  it('config 缺失（旧数据）默认按开启', () => {
    expect(shouldFire({ timers: [{ id: 't', endTime: 1000 }] }, 't', 1000)).toBe(true)
  })
  it('远未到点 → false', () => {
    expect(shouldFire(data([{ id: 't', endTime: 100000 }]), 't', 1000)).toBe(false)
  })
})
