import crypto from 'node:crypto'

export const COOKIE_NAME = 'tb_session'
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 天

function b64urlEncode(str) {
  return Buffer.from(str).toString('base64url')
}

// 签发会话令牌；expMs 为过期时间（epoch 毫秒）
export function signSession(secret, expMs) {
  const payload = b64urlEncode(JSON.stringify({ exp: expMs }))
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

// 校验令牌：签名正确且未过期返回 true
export function verifySession(secret, token, nowMs) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false
  const [payload, sig] = token.split('.')
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return typeof exp === 'number' && exp > nowMs
  } catch {
    return false
  }
}

// 从 Cookie 头里取出指定名字的值
export function parseCookie(header, name) {
  if (!header) return null
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const k = part.slice(0, idx).trim()
    if (k === name) return decodeURIComponent(part.slice(idx + 1).trim())
  }
  return null
}

// 构造登录 Set-Cookie 头
export function buildSessionCookie(token) {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000)
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`
}

// 构造清除登录的 Set-Cookie 头
export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
}

// Serverless 入口守卫：未授权时写 401 并返回 false
export function requireAuth(req, res) {
  const secret = process.env.SESSION_SECRET
  const token = parseCookie(req.headers?.cookie, COOKIE_NAME)
  if (secret && verifySession(secret, token, Date.now())) return true
  res.status(401).json({ error: '未授权' })
  return false
}
