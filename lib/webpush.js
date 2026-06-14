import webpush from 'web-push'

let configured = false
// 首次发送前配置 VAPID
export function configureVapid() {
  if (configured) return
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  )
  configured = true
}

// 默认真实发送器
export function realSender(sub, payloadStr) {
  return webpush.sendNotification(sub, payloadStr)
}

// 向所有订阅发送；返回失效 endpoint 列表（410/404）
export async function sendToAll(subs, payloadStr, sender = realSender) {
  const failed = []
  await Promise.all((subs || []).map(async (s) => {
    try {
      await sender(s, payloadStr)
    } catch (e) {
      const code = e?.statusCode
      if (code === 410 || code === 404) failed.push(s.endpoint)
    }
  }))
  return failed
}
