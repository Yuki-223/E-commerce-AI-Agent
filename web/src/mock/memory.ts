/** Port of backend/agent/memory_extractor.py (deterministic, no LLM). */
import type { PreferenceUpdate } from './state'

const TEMPORARY = ['这次', '今天', '先', '暂时', '试试', '看看', '当前', '本次']
const QUESTION = ['吗', '么', '怎么样', '如何', '好不好', '哪个好', '？', '?']
const HIGH_RISK = ['过敏', '忌口', '不能吃', '不耐受', '孕妇', '哺乳', '疾病', '医生']
const KNOWN_BRANDS = ['Apple', '苹果', 'Nike', '耐克', 'Adidas', '阿迪达斯', '小米', '华为', 'vivo', 'OPPO', '兰蔻', '雅诗兰黛', 'The North Face', '北面']
const BRAND_CANONICAL: Record<string, string> = { 苹果: 'Apple', Apple: 'Apple', 耐克: 'Nike', Nike: 'Nike', 阿迪达斯: 'Adidas', Adidas: 'Adidas' }
const CATEGORY_ALIASES: [string, string][] = [
  ['数码', '数码电子'], ['电子', '数码电子'], ['手机', '数码电子'], ['耳机', '数码电子'],
  ['运动', '服饰运动'], ['服饰', '服饰运动'], ['衣服', '服饰运动'],
  ['美妆', '美妆护肤'], ['护肤', '美妆护肤'], ['食品', '食品生活'], ['家居', '食品生活'],
]
const STYLE_ALIASES: [string, string][] = [
  ['轻一点', '轻量'], ['轻便', '轻量'], ['轻量', '轻量'], ['便携', '轻量'], ['通勤', '通勤'],
  ['性价比', '高性价比'], ['高性价比', '高性价比'], ['品质', '品质优先'], ['质感', '品质优先'],
]

const has = (text: string, markers: string[]) => markers.some((m) => text.includes(m))
const uniq = <T,>(xs: T[]) => [...new Set(xs)]
const canonicalBrand = (b: string) => BRAND_CANONICAL[b] ?? b

function budget(text: string): PreferenceUpdate[] {
  const markers = ['预算', '一般', '平时', '通常', '以后']
  if (!has(text, markers)) return []
  const range = text.match(/(\d{2,6})\s*(?:-|到|至|~|—)\s*(\d{2,6})/)
  if (range) {
    let low = Number(range[1])
    let high = Number(range[2])
    if (low > high) [low, high] = [high, low]
    return [{ field: 'budget_range', value: { budget_min: low, budget_max: high }, message: `已记住：常用预算 ¥${Math.trunc(low)}-¥${Math.trunc(high)}` }]
  }
  const max = text.match(/(\d{2,6})\s*(?:以内|以下|左右)/)
  if (max) {
    const high = Number(max[1])
    return [{ field: 'budget_max', value: high, message: `已记住：常用预算 ¥${Math.trunc(high)} 以内` }]
  }
  return []
}

function brandExclude(text: string): PreferenceUpdate[] {
  if (!has(text, ['不买', '不要', '不推荐', '避开', '排除', '不喜欢'])) return []
  return uniq(KNOWN_BRANDS.filter((b) => text.includes(b)).map(canonicalBrand)).map((brand) => ({
    field: 'brand_exclude', value: brand, message: `已记住：避免推荐 ${brand}`,
  }))
}

function brandInclude(text: string): PreferenceUpdate[] {
  if (!has(text, ['我喜欢', '偏好', '优先', '以后推荐', '常买'])) return []
  if (has(text, ['不喜欢', '不要', '不买', '避开'])) return []
  return uniq(KNOWN_BRANDS.filter((b) => text.includes(b)).map(canonicalBrand)).map((brand) => ({
    field: 'brand_include', value: brand, message: `已记住：优先考虑 ${brand}`,
  }))
}

function styles(text: string): PreferenceUpdate[] {
  if (!has(text, ['以后', '平时', '一般', '偏好', '喜欢', '优先', '推荐'])) return []
  return uniq(STYLE_ALIASES.filter(([m]) => text.includes(m)).map(([, c]) => c)).map((style) => ({
    field: 'preference_keywords', value: style, message: `已记住：偏好${style}`,
  }))
}

function categories(text: string): PreferenceUpdate[] {
  if (!has(text, ['主要看', '常买', '关注', '偏好', '喜欢'])) return []
  return uniq(CATEGORY_ALIASES.filter(([m]) => text.includes(m)).map(([, c]) => c)).map((category) => ({
    field: 'favorite_categories', value: category, message: `已记住：关注${category}`,
  }))
}

export function extractPreferenceUpdates(query: string, userId?: string | null): PreferenceUpdate[] {
  if (!userId) return []
  const text = (query ?? '').trim()
  if (!text || has(text, TEMPORARY) || has(text, QUESTION) || has(text, HIGH_RISK)) return []
  const all = [...budget(text), ...brandExclude(text), ...brandInclude(text), ...styles(text), ...categories(text)]
  const seen = new Set<string>()
  return all.filter((u) => {
    const key = `${u.field}|${JSON.stringify(u.value)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
