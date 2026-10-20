import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/endpoints'
import type { AddressRequest, OrderStatus } from '../api/types'

/** Query keys for the shopper's orders and address book and the merchant console. */
export const ORDERS_KEY = ['orders'] as const
export const ADDRESSES_KEY = ['addresses'] as const
export const MERCHANT_KEY = ['merchant'] as const

export function useOrders(status: OrderStatus | null) {
  return useQuery({ queryKey: [...ORDERS_KEY, status], queryFn: ({ signal }) => api.orders(status, signal) })
}

export function useAddresses() {
  return useQuery({ queryKey: ADDRESSES_KEY, queryFn: ({ signal }) => api.addresses(signal), staleTime: 60_000 })
}

export function useAddressMutations() {
  const qc = useQueryClient()
  const refresh = () => qc.invalidateQueries({ queryKey: ADDRESSES_KEY })
  return {
    create: useMutation({ mutationFn: (req: AddressRequest) => api.createAddress(req), onSuccess: refresh }),
    update: useMutation({ mutationFn: ({ id, req }: { id: number; req: Partial<AddressRequest> }) => api.updateAddress(id, req), onSuccess: refresh }),
    remove: useMutation({ mutationFn: (id: number) => api.deleteAddress(id), onSuccess: refresh }),
  }
}
