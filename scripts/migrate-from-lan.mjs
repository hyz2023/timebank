// 用法：
//   UPSTASH_REDIS_REST_URL=... UPSTASH_REDIS_REST_TOKEN=... \
//   node scripts/migrate-from-lan.mjs [老服务器data接口URL]
import { Redis } from '@upstash/redis'

const LAN_URL = process.argv[2] || 'http://192.168.2.105:3001/api/data'
const KEY = 'timebank:data'

const redis = Redis.fromEnv()

console.log(`📡 正在从老服务器抓取数据：${LAN_URL}`)
const res = await fetch(LAN_URL)
if (!res.ok) {
  console.error(`❌ 抓取失败，HTTP ${res.status}`)
  process.exit(1)
}
const data = await res.json()

await redis.set(KEY, data)
console.log('✅ 已导入 Upstash:', {
  balance: data.balance,
  tasks: Array.isArray(data.tasks) ? data.tasks.length : 0,
  logs: Array.isArray(data.logs) ? data.logs.length : 0,
  timers: Array.isArray(data.timers) ? data.timers.length : 0,
})
