import { requireAuth } from '../../lib/auth.js'
import { readData, saveData } from '../../lib/db.js'
import { pauseTimer, resumeTimer } from '../../lib/operations.js'

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  const { timerId } = req.query
  const { action } = req.body || {}
  try {
    const data = await readData()
    const op = action === 'resume' ? resumeTimer : action === 'pause' ? pauseTimer : null
    if (!op) return res.status(400).json({ error: '未知操作' })
    const { data: next, result } = op(data, timerId, Date.now())
    await saveData(next)
    return res.status(200).json({ success: true, timer: result.timer })
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message })
  }
}
