import { useQuery } from '@tanstack/react-query'
import { api } from '../api/endpoints'
import type { UserPreference } from '../api/types'

export const preferenceKey = (userId: string) => ['preference', userId] as const

export function usePreference(userId: string) {
  return useQuery({ queryKey: preferenceKey(userId), queryFn: ({ signal }) => api.preference(userId, signal) })
}

/** One-line summary under the account name, e.g. "敏感肌 · 不含酒精 · ≤¥500". */
export function preferenceSummary(p: UserPreference | undefined): string {
  if (!p) return ''
  if (!p.personalization_enabled) return '个性化推荐已关闭'
  const parts = [
    ...p.preference_keywords,
    ...p.style_tags.filter((t) => !p.preference_keywords.includes(t)),
    ...p.favorite_categories,
  ]
  if (p.budget_max != null) parts.push(p.budget_min != null ? `¥${p.budget_min}-${p.budget_max}` : `≤¥${p.budget_max}`)
  return parts.slice(0, 3).join(' · ') || '还没有记住偏好'
}
