import { requireAuth } from '../lib/auth.js'
import { readData, saveData } from '../lib/db.js'
import { earn } from '../lib/operations.js'
import { getBeijingDateStr } from '../lib/time.js'

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  try {
    const { taskId, isPerfect } = req.body || {}
    const now = Date.now()
    const data = await readData()
    const { data: next, result } = earn(data, taskId, isPerfect, getBeijingDateStr(new Date(now)), now)
    await saveData(next)
    return res.status(200).json({ success: true, ...result })
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message })
  }
}
