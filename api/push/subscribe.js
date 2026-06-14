import { requireAuth } from '../../lib/auth.js'
import { readSubs, saveSubs } from '../../lib/pushstore.js'
import { upsertSubscription } from '../../lib/push.js'

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return
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
