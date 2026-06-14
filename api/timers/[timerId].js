import { requireAuth } from '../../lib/auth.js'
import { readData, saveData } from '../../lib/db.js'
import { pauseTimer, resumeTimer, setTimerSchedule } from '../../lib/operations.js'
import { scheduleTimerFire, cancelTimerFire, qstashEnabled, resolveBaseUrl } from '../../lib/qstash.js'

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  const { timerId } = req.query
  const { action } = req.body || {}
  try {
    const data = await readData()

    if (action === 'pause') {
      const prev = (data.timers || []).find((t) => t.id === timerId)
      const { data: next, result } = pauseTimer(data, timerId, Date.now())
      if (qstashEnabled()) await cancelTimerFire(prev?.scheduleId)
      const finalData = setTimerSchedule(next, timerId, null)
      await saveData(finalData)
      return res.status(200).json({ success: true, timer: { ...result.timer, scheduleId: null } })
    }

    if (action === 'resume') {
      const { data: next, result } = resumeTimer(data, timerId, Date.now())
      let scheduleId = null
      if (qstashEnabled()) {
        try {
          scheduleId = await scheduleTimerFire(result.timer, {
            baseUrl: resolveBaseUrl(),
            secret: process.env.PUSH_FIRE_SECRET,
          })
        } catch (e) {
          console.error('[TimeBank] QStash 重排失败:', e?.message)
        }
      }
      const finalData = setTimerSchedule(next, timerId, scheduleId)
      await saveData(finalData)
      return res.status(200).json({ success: true, timer: { ...result.timer, scheduleId } })
    }

    return res.status(400).json({ error: '未知操作' })
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message })
  }
}
