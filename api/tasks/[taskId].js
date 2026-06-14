import { requireAuth } from '../../lib/auth.js'
import { readData, saveData } from '../../lib/db.js'
import { updateTask, removeTask } from '../../lib/operations.js'

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return
  const { taskId } = req.query
  try {
    const data = await readData()
    if (req.method === 'PUT') {
      const { data: next, result } = updateTask(data, taskId, req.body || {})
      await saveData(next)
      return res.status(200).json({ success: true, task: result })
    }
    if (req.method === 'DELETE') {
      const { data: next } = removeTask(data, taskId)
      await saveData(next)
      return res.status(200).json({ success: true })
    }
    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (e) {
    return res.status(e.statusCode || 500).json({ error: e.message })
  }
}
