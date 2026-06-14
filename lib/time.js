// 北京时间 (UTC+8) 日期工具
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000

// 给定时间点，返回北京时区下的 YYYY-MM-DD 字符串
export function getBeijingDateStr(date = new Date()) {
  const beijing = new Date(date.getTime() + BEIJING_OFFSET_MS)
  const y = beijing.getUTCFullYear()
  const m = String(beijing.getUTCMonth() + 1).padStart(2, '0')
  const d = String(beijing.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
