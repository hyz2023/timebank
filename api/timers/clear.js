import { requireAuth } from '../../lib/auth.js'
import { readData, saveData } from '../../lib/db.js'
import { clearExpiredTimers } from '../../lib/operations.js'
import { cancelTimerFire, qstashEnabled } from '../../lib/qstash.js'

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  try {
    const data = await readData()
    const now = Date.now()
    // 被清除的（已过期、未暂停）计时器，取消其残留排程（多数已投递，取消为 best-effort）
    const removed = (data.timers || []).filter((t) => !t.paused && t.endTime != null && t.endTime <= now)
    const { data: next, result } = clearExpiredTimers(data, now)
    if (qstashEnabled()) {
      await Promise.all(removed.map((t) => cancelTimerFire(t.scheduleId)))
    }
    await saveData(next)
    return res.status(200).json({ success: true, removed: result.removed })
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message })
  }
}
