import { describe, it, expect } from 'vitest'
import { signSession, verifySession, parseCookie, COOKIE_NAME } from '../lib/auth.js'

const SECRET = 'test-secret'
const NOW = 1_000_000

describe('signSession / verifySession', () => {
  it('合法且未过期的令牌通过校验', () => {
    const token = signSession(SECRET, NOW + 10_000)
    expect(verifySession(SECRET, token, NOW)).toBe(true)
  })
  it('过期令牌不通过', () => {
    const token = signSession(SECRET, NOW - 1)
    expect(verifySession(SECRET, token, NOW)).toBe(false)
  })
  it('错误密钥签发的令牌不通过', () => {
    const token = signSession('other-secret', NOW + 10_000)
    expect(verifySession(SECRET, token, NOW)).toBe(false)
  })
  it('被篡改的令牌不通过', () => {
    const token = signSession(SECRET, NOW + 10_000) + 'x'
    expect(verifySession(SECRET, token, NOW)).toBe(false)
  })
  it('空令牌不通过', () => {
    expect(verifySession(SECRET, '', NOW)).toBe(false)
    expect(verifySession(SECRET, null, NOW)).toBe(false)
  })
})

describe('parseCookie', () => {
  it('能取出指定 cookie 值', () => {
    expect(parseCookie(`a=1; ${COOKIE_NAME}=abc.def; b=2`, COOKIE_NAME)).toBe('abc.def')
  })
  it('不存在时返回 null', () => {
    expect(parseCookie('a=1', COOKIE_NAME)).toBe(null)
    expect(parseCookie(undefined, COOKIE_NAME)).toBe(null)
  })
})
