// 到站音：播放用户提供的广州地铁关门铃声（约 6.8 秒，播一遍）
let audioEl = null
let unlocked = false

function el() {
  if (!audioEl) {
    audioEl = new Audio('/sounds/arrival.mp3')
    audioEl.preload = 'auto'
  }
  return audioEl
}

// 首个用户手势时调用，解锁移动端自动播放限制
export function unlockArrivalSound() {
  if (unlocked) return
  const a = el()
  a.muted = true
  a.play()
    .then(() => { a.pause(); a.currentTime = 0; a.muted = false; unlocked = true })
    .catch(() => { a.muted = false })
}

// 从头播放一遍
export function playArrivalSound() {
  const a = el()
  try { a.currentTime = 0 } catch { /* 忽略 */ }
  a.loop = false // 文件约 6.8 秒，播一遍即可
  return a.play().catch(() => {})
}

// 立即停止
export function stopArrivalSound() {
  if (!audioEl) return
  audioEl.pause()
  try { audioEl.currentTime = 0 } catch { /* 忽略 */ }
}
