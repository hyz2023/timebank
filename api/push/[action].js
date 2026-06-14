import { requireAuth } from '../../lib/auth.js'
import { readData } from '../../lib/db.js'
import { readSubs, saveSubs } from '../../lib/pushstore.js'
import { upsertSubscription, shouldFire, buildPushPayload, removeEndpoints } from '../../lib/push.js'
import { configureVapid, sendToAll } from '../../lib/webpush.js'

// 三个推送动作合并为一个动态路由函数，以控制 Hobby 套餐的 12 个 Serverless Function 上限：
//   GET  /api/push/public-key  → 返回 VAPID 公钥（cookie 鉴权）
//   POST /api/push/subscribe   → 保存订阅（cookie 鉴权）
//   POST /api/push/fire        → QStash 到点回调发推送（x-fire-token 头鉴权）
export default async function handler(req, res) {
  const { action } = req.query

  // QStash 到点回调：密钥经转发头 x-fire-token 传来，不用 cookie
  if (action === 'fire') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
    const token = req.headers['x-fire-token']
    if (!process.env.PUSH_FIRE_SECRET || token !== process.env.PUSH_FIRE_SECRET) {
      return res.status(401).json({ error: '未授权' })
    }
    try {
      const timerId = req.query?.timerId
      const data = await readData()
      if (!shouldFire(data, timerId, Date.now())) {
        return res.status(200).json({ skipped: true })
      }
      const timer = data.timers.find((t) => t.id === timerId)
      configureVapid()
      const subs = await readSubs()
      const failed = await sendToAll(subs, JSON.stringify(buildPushPayload(timer)))
      if (failed.length) await saveSubs(removeEndpoints(subs, failed))
      return res.status(200).json({ sent: subs.length - failed.length, pruned: failed.length })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  // 其余动作需 cookie 鉴权
  if (!requireAuth(req, res)) return

  if (action === 'public-key') {
    return res.status(200).json({ key: process.env.VAPID_PUBLIC_KEY || '' })
  }

  if (action === 'subscribe') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
    try {
      const sub = req.body?.subscription
      if (!sub?.endpoint) return res.status(400).json({ error: '订阅无效' })
      const subs = await readSubs()
      await saveSubs(upsertSubscription(subs, sub))
      return res.status(200).json({ success: true })
    } catch (e) {
      return res.status(500).json({ error: e.message })
    }
  }

  return res.status(404).json({ error: 'Not Found' })
}
