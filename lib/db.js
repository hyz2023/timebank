import { Redis } from '@upstash/redis'
import { getBeijingDateStr } from './time.js'
import { getDefaultData, applyDailyReset } from './operations.js'

const KEY = 'timebank:data'

// 从环境变量读取 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
export const redis = Redis.fromEnv()

// 读取全部数据，并按北京日期做懒惰每日重置
export async function readData() {
  const today = getBeijingDateStr()
  let data = await redis.get(KEY) // @upstash/redis 自动反序列化 JSON
  if (!data) {
    data = getDefaultData(today)
    await redis.set(KEY, data)
    return data
  }
  const reset = applyDailyReset(data, today)
  if (reset !== data) await redis.set(KEY, reset)
  return reset
}

// 覆盖保存全部数据
export async function saveData(data) {
  await redis.set(KEY, data)
  return data
}
