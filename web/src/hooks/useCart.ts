import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/endpoints'
import type { CartMutationRequest, CartResponse } from '../api/types'

export const CART_KEY = ['cart'] as const

/** GET /cart snapshot; the cart is global (one per backend, shared by all profiles). */
export function useCart() {
  return useQuery({ queryKey: CART_KEY, queryFn: ({ signal }) => api.cart(signal), staleTime: 5_000 })
}

/** POST /cart/mutate; the response is the new snapshot, written straight into the cache. */
export function useCartMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req: CartMutationRequest) => api.mutateCart(req),
    onSuccess: (snapshot) => qc.setQueryData<CartResponse>(CART_KEY, snapshot),
  })
}
