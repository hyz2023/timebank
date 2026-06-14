import { clearSessionCookie } from '../lib/auth.js'

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  res.setHeader('Set-Cookie', clearSessionCookie())
  return res.status(200).json({ success: true })
}
