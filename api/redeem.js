import { requireAuth } from '../lib/auth.js'
import { readData, saveData } from '../lib/db.js'
import { redeem, setTimerSchedule } from '../lib/operations.js'
import { scheduleTimerFire, qstashEnabled, resolveBaseUrl } from '../lib/qstash.js'

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  try {
    const { tier } = req.body || {}
    const data = await readData()
    const { data: next, result } = redeem(data, tier, Date.now())

    // 排程到点推送（best-effort，失败不阻断兑换）
    let scheduleId = null
    if (qstashEnabled()) {
      try {
        scheduleId = await scheduleTimerFire(result.timer, {
          baseUrl: resolveBaseUrl(),
          secret: process.env.PUSH_FIRE_SECRET,
        })
      } catch (e) {
        console.error('[TimeBank] QStash 排程失败:', e?.message)
      }
    }

    const finalData = scheduleId ? setTimerSchedule(next, result.timer.id, scheduleId) : next
    await saveData(finalData)
    return res.status(200).json({ success: true, ...result, timer: { ...result.timer, scheduleId } })
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message })
  }
}
