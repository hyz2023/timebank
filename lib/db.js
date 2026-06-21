import { Redis } from '@upstash/redis'
import { getBeijingDateStr } from './time.js'
import { getDefaultData, applyDailyReset, normalizeTaskCategories } from './operations.js'

const KEY = 'timebank:data'

// Vercel 的 Upstash 集成注入 KV_REST_API_URL / KV_REST_API_TOKEN；
// 本地或其他环境也可能用 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN。两者都兼容。
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
export const redis = new Redis({ url: REDIS_URL, token: REDIS_TOKEN })

// 读取全部数据，并按北京日期做懒惰每日重置
export async function readData() {
  const today = getBeijingDateStr()
  let data = await redis.get(KEY) // @upstash/redis 自动反序列化 JSON
  if (!data) {
    data = getDefaultData(today)
    await redis.set(KEY, data)
    return data
  }
  const normalized = normalizeTaskCategories(data)
  const reset = applyDailyReset(normalized, today)
  if (reset !== data) await redis.set(KEY, reset)
  return reset
}

// 覆盖保存全部数据
export async function saveData(data) {
  await redis.set(KEY, data)
  return data
}
