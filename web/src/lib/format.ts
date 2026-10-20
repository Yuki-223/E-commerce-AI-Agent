/** Small display helpers. Prices always come from the API; these only format them. */

export function startOfDay(t: number): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function historyGroup(t: number, now = Date.now()): '今天' | '昨天' | '更早' {
  const today = startOfDay(now)
  if (t >= today) return '今天'
  if (t >= today - 86_400_000) return '昨天'
  return '更早'
}

export function historyTime(t: number, now = Date.now()): string {
  const d = new Date(t)
  if (historyGroup(t, now) === '更早') return `${d.getMonth() + 1}月${d.getDate()}日`
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Yuan amount from the API (unit_price, subtotal, total) as "¥340.00". */
export function yuan2(n: number): string {
  return `¥${n.toFixed(2)}`
}

/** Yuan amount without trailing zeros, like the backend's f"¥{x:g}". */
export function yuan(n: number): string {
  return `¥${String(Number(n.toPrecision(6)))}`
}

export function optionsText(options: Record<string, string>): string {
  return Object.values(options).join(' / ')
}

/** Home greeting by local hour: 5–11 早上, 11–13 中午, 13–18 下午, otherwise 晚上. */
export function greeting(now = new Date()): string {
  const h = now.getHours()
  if (h >= 5 && h < 11) return '早上好'
  if (h >= 11 && h < 13) return '中午好'
  if (h >= 13 && h < 18) return '下午好'
  return '晚上好'
}
