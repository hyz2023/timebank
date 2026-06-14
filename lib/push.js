// 推送相关纯函数

// 按 endpoint 去重地加入/更新一条订阅
export function upsertSubscription(subs, sub) {
  const list = Array.isArray(subs) ? subs : []
  return [...list.filter((s) => s.endpoint !== sub.endpoint), sub]
}

// 从订阅列表移除指定 endpoint（失效订阅）
export function removeEndpoints(subs, endpoints) {
  const dead = new Set(endpoints)
  return (Array.isArray(subs) ? subs : []).filter((s) => !dead.has(s.endpoint))
}

// 构造系统通知载荷
export function buildPushPayload(timer) {
  return {
    title: '✈️ 飞行到站！',
    body: `「${timer?.label ?? '游戏时间'}」游戏时间结束啦`,
    tag: timer?.id ?? 'timebank-timer',
    url: '/?tab=timer',
  }
}

const FIRE_TOLERANCE_MS = 5000

// 到点回调时校验该计时器是否仍应通知
export function shouldFire(data, timerId, nowMs) {
  if (!data || data.config?.notifyOnExpire === false) return false
  const timer = (data.timers || []).find((t) => t.id === timerId)
  if (!timer || timer.paused || timer.endTime == null) return false
  return timer.endTime <= nowMs + FIRE_TOLERANCE_MS
}
