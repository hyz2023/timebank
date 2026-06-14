import { readData } from '../../lib/db.js'
import { readSubs, saveSubs } from '../../lib/pushstore.js'
import { shouldFire, buildPushPayload, removeEndpoints } from '../../lib/push.js'
import { configureVapid, sendToAll } from '../../lib/webpush.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  // 共享密钥鉴权：密钥经 QStash 转发头 x-fire-token 传来，不在 URL 里
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
