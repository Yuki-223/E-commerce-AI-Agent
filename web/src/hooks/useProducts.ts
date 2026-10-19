import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/endpoints'
import type { Product } from '../api/types'

/** GET /products?ids= in the given order; also seeds the single-product cache. */
export function useProducts(ids: string[] | undefined) {
  const qc = useQueryClient()
  const key = (ids ?? []).join(',')
  return useQuery({
    queryKey: ['products', key],
    enabled: Boolean(ids?.length),
    staleTime: 5 * 60_000,
    queryFn: async ({ signal }) => {
      const products = await api.products(ids!, signal)
      for (const p of products) qc.setQueryData<Product>(['product', p.productID], p)
      const byId = new Map(products.map((p) => [p.productID, p]))
      return ids!.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p))
    },
  })
}

export function useProduct(productId: string | null | undefined) {
  return useQuery({
    queryKey: ['product', productId],
    enabled: Boolean(productId),
    staleTime: 5 * 60_000,
    queryFn: ({ signal }) => api.product(productId!, signal),
  })
}

/** First sentence of the marketing copy, used when the composer gave no description. */
export function shortSummary(p: Product): string {
  const s = p.summary ?? ''
  const first = s.split(/(?<=[。！？])/)[0] ?? ''
  return first.length > 60 ? `${first.slice(0, 58)}…` : first
}
