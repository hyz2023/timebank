// TimeBank 服务端积分计算引擎（权威口径，与前端 src/engine.js 保持一致）

// 根据"当前已完成次数"返回本次的衰减系数
export function getDecayMultiplier(currentDailyCount) {
  const next = currentDailyCount + 1
  if (next >= 5) return 0.5
  if (next >= 3) return 0.75
  return 1.0
}

// 计算本次任务得分（含衰减与完美奖励），四舍五入到两位小数
export function calculatePoints(task, isPerfect) {
  const multiplier = getDecayMultiplier(task.dailyCount)
  let points = task.basePoints * multiplier
  if (isPerfect) points += task.bonusPoints * multiplier
  return Math.round(points * 100) / 100
}
