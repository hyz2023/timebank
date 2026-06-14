import { requireAuth } from '../../lib/auth.js'
import { readData, saveData } from '../../lib/db.js'
import { addTask } from '../../lib/operations.js'
import { getBeijingDateStr } from '../../lib/time.js'

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  try {
    const now = Date.now()
    const data = await readData()
    const { data: next, result } = addTask(data, req.body || {}, getBeijingDateStr(new Date(now)), now)
    await saveData(next)
    return res.status(200).json({ success: true, task: result })
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message })
  }
}
