import { requireAuth } from '../lib/auth.js'
import { readData, saveData } from '../lib/db.js'
import { adjustBalance } from '../lib/operations.js'

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' })
  try {
    const { amount } = req.body || {}
    const data = await readData()
    const { data: next, result } = adjustBalance(data, amount, Date.now())
    await saveData(next)
    return res.status(200).json({ success: true, ...result })
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message })
  }
}
