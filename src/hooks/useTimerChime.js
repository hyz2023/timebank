import { useEffect, useRef, useState } from 'react'
import { pickNewlyExpired } from '../utils/timerChime'
import { playArrivalSound, stopArrivalSound, unlockArrivalSound } from '../utils/arrivalSound'

const FIRED_KEY = 'timebank-chimed-timers'

function loadFired() {
  try { return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) || '[]')) } catch { return new Set() }
}
function saveFired(set) {
  try { localStorage.setItem(FIRED_KEY, JSON.stringify([...set])) } catch { /* 忽略 */ }
}

export default function useTimerChime(timers) {
  const firedRef = useRef(loadFired())
  const timeoutsRef = useRef(new Map())
  const [arrivedCount, setArrivedCount] = useState(0)

  // 首个用户手势解锁音频
  useEffect(() => {
    const onGesture = () => { unlockArrivalSound() }
    window.addEventListener('pointerdown', onGesture, { once: true })
    return () => window.removeEventListener('pointerdown', onGesture)
  }, [])

  const fire = (ids) => {
    if (!ids.length) return
    ids.forEach((id) => firedRef.current.add(id))
    saveFired(firedRef.current)
    setArrivedCount((c) => c + ids.length)
    playArrivalSound()
  }

  // 为每个未来到站的计时器设精确 setTimeout；并立即补响"加载前已到站"的
  useEffect(() => {
    const now = Date.now()
    fire(pickNewlyExpired(timers, firedRef.current, now))

    timeoutsRef.current.forEach((h) => clearTimeout(h))
    timeoutsRef.current.clear()

    ;(timers || []).forEach((t) => {
      if (t.paused || t.endTime == null) return
      const delay = t.endTime - now
      if (delay <= 0 || firedRef.current.has(t.id)) return
      const h = setTimeout(() => fire([t.id]), delay)
      timeoutsRef.current.set(t.id, h)
    })

    // 清理已不存在的 id，避免 localStorage 无限增长
    const present = new Set((timers || []).map((t) => t.id))
    let changed = false
    firedRef.current.forEach((id) => { if (!present.has(id)) { firedRef.current.delete(id); changed = true } })
    if (changed) saveFired(firedRef.current)

    return () => {
      timeoutsRef.current.forEach((h) => clearTimeout(h))
      timeoutsRef.current.clear()
    }
  }, [timers])

  // 回到前台补响（隐藏期间到站的）
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fire(pickNewlyExpired(timers, firedRef.current, Date.now()))
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [timers])

  const dismiss = () => { stopArrivalSound(); setArrivedCount(0) }
  return { arrivedCount, dismiss }
}
