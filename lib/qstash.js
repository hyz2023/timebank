import { Client } from '@upstash/qstash'

let _client = null
function client() {
  if (!_client) _client = new Client({ token: process.env.QSTASH_TOKEN })
  return _client
}

// endTime(ms) → QStash notBefore（Unix 秒）
export function toNotBeforeSeconds(endTimeMs) {
  return Math.ceil(endTimeMs / 1000)
}

// 构造到点回调 URL（仅带 timerId；密钥走 HTTP 头，不入 URL）
export function buildFireUrl(baseUrl, timerId) {
  const u = new URL('/api/push/fire', baseUrl)
  u.searchParams.set('timerId', timerId)
  return u.toString()
}

// 解析公开站点地址：优先 PUBLIC_BASE_URL，其次 Vercel 注入的 VERCEL_URL
export function resolveBaseUrl() {
  return process.env.PUBLIC_BASE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
}

// 当前部署是否具备排程条件
export function qstashEnabled() {
  return Boolean(process.env.QSTASH_TOKEN && process.env.PUSH_FIRE_SECRET && resolveBaseUrl())
}

// 为计时器排程到点回调，返回 messageId（失败抛错由调用方兜底）
// 共享密钥通过 Upstash-Forward 转发头 x-fire-token 传给回调端，避免出现在 URL/日志里
export async function scheduleTimerFire(timer, { baseUrl, secret, qstash = client() } = {}) {
  const res = await qstash.publishJSON({
    url: buildFireUrl(baseUrl, timer.id),
    body: { timerId: timer.id },
    notBefore: toNotBeforeSeconds(timer.endTime),
    headers: { 'x-fire-token': secret },
  })
  return res?.messageId ?? null
}

// 取消已排程消息（best-effort；已投递/不存在则忽略）
export async function cancelTimerFire(scheduleId, { qstash = client() } = {}) {
  if (!scheduleId) return
  try { await qstash.messages.delete(scheduleId) } catch { /* 忽略 */ }
}
