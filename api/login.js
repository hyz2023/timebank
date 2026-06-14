import crypto from 'node:crypto'
import { signSession, buildSessionCookie, SESSION_TTL_MS } from '../lib/auth.js'
import { checkLoginRate, recordLoginFail, resetLoginRate } from '../lib/ratelimit.js'

function safeEqual(a, b) {
  const ab = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms))

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'
  const gate = await checkLoginRate(ip)
  if (!gate.allowed) return res.status(429).json({ error: '尝试过于频繁，请稍后再试' })

  const password = req.body?.password ?? ''
  const expected = process.env.APP_PASSWORD ?? ''
  const ok = expected.length > 0 && safeEqual(password, expected)

  if (!ok) {
    await recordLoginFail(ip)
    await delay(500)
    return res.status(401).json({ error: '密码错误' })
  }

  await resetLoginRate(ip)
  const token = signSession(process.env.SESSION_SECRET, Date.now() + SESSION_TTL_MS)
  res.setHeader('Set-Cookie', buildSessionCookie(token))
  return res.status(200).json({ success: true })
}
