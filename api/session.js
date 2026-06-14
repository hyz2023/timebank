import { requireAuth } from '../lib/auth.js'

// 仅用于前端 AuthGate 启动时判断是否已登录
export default function handler(req, res) {
  if (!requireAuth(req, res)) return
  return res.status(200).json({ authed: true })
}
