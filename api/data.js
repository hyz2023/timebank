import { requireAuth } from '../lib/auth.js'
import { readData, saveData } from '../lib/db.js'

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return

  try {
    if (req.method === 'GET') {
      const data = await readData()
      return res.status(200).json(data)
    }
    if (req.method === 'POST') {
      await saveData(req.body)
      return res.status(200).json({ success: true, message: '数据已保存' })
    }
    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message })
  }
}
