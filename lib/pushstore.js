import { redis } from './db.js'

const SUBS_KEY = 'timebank:push:subs'

// 读取所有推送订阅
export async function readSubs() {
  const subs = await redis.get(SUBS_KEY)
  return Array.isArray(subs) ? subs : []
}

// 覆盖保存推送订阅
export async function saveSubs(subs) {
  await redis.set(SUBS_KEY, subs)
  return subs
}
