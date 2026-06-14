// 找出"刚到站且尚未响过"的计时器 id（纯函数）
export function pickNewlyExpired(timers, firedIds, nowMs) {
  const fired = firedIds instanceof Set ? firedIds : new Set(firedIds || [])
  return (timers || [])
    .filter((t) => !t.paused && t.endTime != null && t.endTime <= nowMs && !fired.has(t.id))
    .map((t) => t.id)
}

// 在 id ∈ ids 的计时器中，返回到站时间（endTime）最新的一个 {id, label}；ids 为空或无匹配返回 null（纯函数）
export function mostRecentArrived(timers, ids) {
  const idSet = ids instanceof Set ? ids : new Set(ids || [])
  let best = null
  for (const t of timers || []) {
    if (!idSet.has(t.id)) continue
    if (best === null || (t.endTime ?? 0) > (best.endTime ?? 0)) best = t
  }
  return best ? { id: best.id, label: best.label } : null
}
