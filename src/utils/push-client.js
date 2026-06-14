function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}
export function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
}
export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  return navigator.serviceWorker.register('/sw.js')
}

// 请求权限 + 订阅 + 上报；成功返回 true，否则抛错（message 可直接展示）
export async function enablePush() {
  if (!pushSupported()) throw new Error('当前环境不支持推送')
  const reg = await registerServiceWorker()
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('未授予通知权限')

  const keyRes = await fetch('/api/push/public-key', { credentials: 'include' })
  const { key } = await keyRes.json()
  if (!key) throw new Error('服务端未配置推送公钥')

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key),
  })
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub }),
  })
  if (!res.ok) throw new Error('订阅上报失败')
  return true
}
