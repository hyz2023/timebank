import { requireAuth } from '../../lib/auth.js'
import { readData, saveData } from '../../lib/db.js'
import { clearExpiredTimers } from '../../lib/operations.js'

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  const data = await readData()
  const { data: next, result } = clearExpiredTimers(data, Date.now())
  await saveData(next)
  return res.status(200).json({ success: true, removed: result.removed })
}
