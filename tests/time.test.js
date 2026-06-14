import { describe, it, expect } from 'vitest'
import { getBeijingDateStr } from '../lib/time.js'

describe('getBeijingDateStr', () => {
  it('当 UTC 23:59 时北京已是次日凌晨', () => {
    expect(getBeijingDateStr(new Date('2026-06-14T16:30:00Z'))).toBe('2026-06-15')
  })
  it('当 UTC 15:59 时北京仍是当天 23:59', () => {
    expect(getBeijingDateStr(new Date('2026-06-14T15:59:59Z'))).toBe('2026-06-14')
  })
  it('月初跨月正确', () => {
    expect(getBeijingDateStr(new Date('2026-01-31T20:00:00Z'))).toBe('2026-02-01')
  })
})
