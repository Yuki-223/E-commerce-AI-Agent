import { useEffect } from 'react'
import { create } from 'zustand'

const KEY = 'cartpilot.recentProducts'
const MAX = 8

function read(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, MAX) : []
  } catch {
    return []
  }
}

/** Product ids whose detail was opened, newest first; feeds 引用商品 › 最近看过. */
export const useRecentProducts = create<{ ids: string[]; record: (id: string) => void }>((set, get) => ({
  ids: read(),
  record: (id) => {
    const ids = [id, ...get().ids.filter((x) => x !== id)].slice(0, MAX)
    try {
      localStorage.setItem(KEY, JSON.stringify(ids))
    } catch {
      /* ignore */
    }
    set({ ids })
  },
}))

/** Note a product detail view once its data has loaded. */
export function useRecordView(productId: string | undefined) {
  const record = useRecentProducts((s) => s.record)
  useEffect(() => {
    if (productId) record(productId)
  }, [productId, record])
}
