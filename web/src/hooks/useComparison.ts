import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '../api/endpoints'
import type { Comparison } from '../api/types'

export const MAX_COMPARE = 4

/**
 * POST /compare for 2–4 products. main.py keeps only the first two ids, so for
 * three or four the client asks pairwise (first + each other) and lines the
 * columns up by row label. Values are the backend's; only the "lowest price"
 * marker is re-picked across all columns from the products' API prices.
 */
export function mergeComparisons(ids: string[], pairs: Comparison[]): Comparison {
  if (pairs.length === 1) return pairs[0]
  const products = ids
    .map((id) => pairs.flatMap((c) => c.products).find((p) => p.product_id === id))
    .filter((p): p is Comparison['products'][number] => Boolean(p))
  const labels: string[] = []
  for (const c of pairs) for (const r of c.rows) if (!labels.includes(r.label)) labels.push(r.label)
  const valueOf = (label: string, productId: string) => {
    for (const c of pairs) {
      const col = c.products.findIndex((p) => p.product_id === productId)
      const row = c.rows.find((r) => r.label === label)
      if (col >= 0 && row) return row.values[col]
    }
    return '—'
  }
  let cheapest = 0
  products.forEach((p, i) => {
    if (p.price < products[cheapest].price) cheapest = i
  })
  return {
    title: `对比：${products.map((p) => Array.from(p.title).slice(0, 16).join('')).join(' vs ')}`,
    products,
    rows: labels.map((label) => ({
      label,
      values: products.map((p) => valueOf(label, p.product_id)),
      highlight: label === '价格' ? cheapest : null,
    })),
    recommendation: '',
  }
}

/**
 * The last table cut down to `ids`, or null when some id is not in it. Lets a
 * removed column disappear at once while the new pairwise /compare runs.
 */
export function narrowComparison(c: Comparison, ids: string[]): Comparison | null {
  const cols = ids.map((id) => c.products.findIndex((p) => p.product_id === id))
  if (cols.some((i) => i < 0)) return null
  const products = cols.map((i) => c.products[i])
  let cheapest = 0
  products.forEach((p, i) => {
    if (p.price < products[cheapest].price) cheapest = i
  })
  return {
    ...c,
    products,
    rows: c.rows.map((r) => ({
      ...r,
      values: cols.map((i) => r.values[i]),
      highlight: r.label === '价格' ? cheapest : r.highlight === null ? null : cols.indexOf(r.highlight) >= 0 ? cols.indexOf(r.highlight) : null,
    })),
  }
}

/**
 * While a changed id set loads, keeps showing a table instead of 正在生成对比…:
 * the old one narrowed to the remaining columns after a removal, or the old one
 * as is (isPlaceholderData, shown dimmed) while an added column loads.
 */
export function useComparison(ids: string[]) {
  const key = ids.join(',')
  return useQuery({
    queryKey: ['compare', key],
    enabled: ids.length >= 2,
    staleTime: 60_000,
    placeholderData: (prev) => (prev && narrowComparison(prev, ids)) ?? keepPreviousData(prev),
    queryFn: async () => {
      const [first, ...rest] = ids.slice(0, MAX_COMPARE)
      const pairs = await Promise.all(rest.map((other) => api.compare([first, other])))
      return mergeComparisons(ids.slice(0, MAX_COMPARE), pairs)
    },
  })
}
