import { redis } from './db.js'

const MAX_FAILS = 5
const WINDOW_SEC = 10 * 60 // 10 分钟

// 是否允许尝试登录
export async function checkLoginRate(ip) {
  const fails = await redis.get(`login:fail:${ip}`)
  return { allowed: !fails || Number(fails) < MAX_FAILS }
}

// 记录一次失败
export async function recordLoginFail(ip) {
  const key = `login:fail:${ip}`
  const n = await redis.incr(key)
  if (n === 1) await redis.expire(key, WINDOW_SEC)
}

// 登录成功后清除失败计数
export async function resetLoginRate(ip) {
  await redis.del(`login:fail:${ip}`)
}
