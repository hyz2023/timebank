// 找出"刚到站且尚未响过"的计时器 id（纯函数）
export function pickNewlyExpired(timers, firedIds, nowMs) {
  const fired = firedIds instanceof Set ? firedIds : new Set(firedIds || [])
  return (timers || [])
    .filter((t) => !t.paused && t.endTime != null && t.endTime <= nowMs && !fired.has(t.id))
    .map((t) => t.id)
}
