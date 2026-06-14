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
