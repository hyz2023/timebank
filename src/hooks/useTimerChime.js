import { useEffect, useRef, useState } from 'react'
import { pickNewlyExpired, mostRecentArrived } from '../utils/timerChime'
import { playArrivalSound, stopArrivalSound, unlockArrivalSound } from '../utils/arrivalSound'

const SEEN_KEY = 'timebank-chimed-timers'   // 已读集合（沿用旧 key）
const INIT_KEY = 'timebank-chime-initialized' // 是否已静默消化过历史 backlog

function loadSeen() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || '[]')) } catch { return new Set() }
}
function saveSeen(set) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([...set])) } catch { /* 忽略 */ }
}

export default function useTimerChime(timers) {
  const seenRef = useRef(loadSeen())
  const timeoutsRef = useRef(new Map())
  const seededRef = useRef(false) // 本组件生命周期内只 seed 一次（防止列表变化时把新到站当 backlog 静默）
  const [lastArrived, setLastArrived] = useState(null)

  // 首个用户手势解锁音频
  useEffect(() => {
    const onGesture = () => { unlockArrivalSound() }
    window.addEventListener('pointerdown', onGesture, { once: true })
    return () => window.removeEventListener('pointerdown', onGesture)
  }, [])

  // 首次加载静默消化历史 backlog（每个客户端一次）：把当时所有"已到站"的计时器标记已读，不响不弹
  const seedBacklogOnce = (list) => {
    if (seededRef.current) return
    seededRef.current = true
    try { if (localStorage.getItem(INIT_KEY)) return } catch { /* 忽略，继续 seed */ }
    const expiredIds = pickNewlyExpired(list, seenRef.current, Date.now())
    expiredIds.forEach((id) => seenRef.current.add(id))
    if (expiredIds.length) saveSeen(seenRef.current)
    try { localStorage.setItem(INIT_KEY, '1') } catch { /* 忽略 */ }
  }

  // 播报：仅前台可见时，把未读已到站项全部标记已读，并弹最近一个、播一遍声音
  const announceArrivals = (list) => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    const ids = pickNewlyExpired(list, seenRef.current, Date.now())
    if (!ids.length) return
    ids.forEach((id) => seenRef.current.add(id))
    saveSeen(seenRef.current)
    const latest = mostRecentArrived(list, ids)
    if (latest) setLastArrived(latest)
    playArrivalSound()
  }

  // 主效果：seed backlog（仅首次）→ 补响未读（可见才响）→ 为未来计时器设精确 setTimeout → 修剪集合
  useEffect(() => {
    seedBacklogOnce(timers)
    announceArrivals(timers)

    timeoutsRef.current.forEach((h) => clearTimeout(h))
    timeoutsRef.current.clear()
    const now = Date.now()
    ;(timers || []).forEach((t) => {
      if (t.paused || t.endTime == null) return
      const delay = t.endTime - now
      if (delay <= 0 || seenRef.current.has(t.id)) return
      const h = setTimeout(() => announceArrivals(timers), delay)
      timeoutsRef.current.set(t.id, h)
    })

    // 修剪已不存在的 id，避免 localStorage 无限增长
    const present = new Set((timers || []).map((t) => t.id))
    let changed = false
    seenRef.current.forEach((id) => { if (!present.has(id)) { seenRef.current.delete(id); changed = true } })
    if (changed) saveSeen(seenRef.current)

    return () => {
      timeoutsRef.current.forEach((h) => clearTimeout(h))
      timeoutsRef.current.clear()
    }
  }, [timers])

  // 回到前台补响离开期间到站的未读项
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') announceArrivals(timers)
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [timers])

  const dismiss = () => { stopArrivalSound(); setLastArrived(null) }
  return { lastArrived, dismiss }
}
