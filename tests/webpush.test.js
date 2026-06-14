import { describe, it, expect } from 'vitest'
import { sendToAll } from '../lib/webpush.js'

const subs = [{ endpoint: 'ok1' }, { endpoint: 'gone' }, { endpoint: 'ok2' }, { endpoint: 'err500' }]

describe('sendToAll', () => {
  it('收集 410/404 失效 endpoint，忽略其他错误', async () => {
    const sender = (sub) => {
      if (sub.endpoint === 'gone') return Promise.reject({ statusCode: 410 })
      if (sub.endpoint === 'err500') return Promise.reject({ statusCode: 500 })
      return Promise.resolve()
    }
    const failed = await sendToAll(subs, '{}', sender)
    expect(failed).toEqual(['gone'])
  })
  it('全部成功返回空数组', async () => {
    const failed = await sendToAll(subs, '{}', () => Promise.resolve())
    expect(failed).toEqual([])
  })
  it('订阅为空安全返回', async () => {
    expect(await sendToAll(undefined, '{}', () => Promise.resolve())).toEqual([])
  })
})
