/** Typed REST calls, one per backend endpoint the web client uses. */
import { getJSON, sendJSON } from './http'
import type {
  CartMutationRequest, CartResponse, Comparison, OrderRequest, OrderResponse, HealthResponse, PreferenceRequest, PreferenceUndoResponse,
  Product, ProductsResponse, SuggestionsResponse, TitleResponse, UserPreference,
} from './types'

const enc = encodeURIComponent

export const api = {
  health: (signal?: AbortSignal) => getJSON<HealthResponse>('/health', signal),
  product: (id: string, signal?: AbortSignal) => getJSON<Product>(`/products/${enc(id)}`, signal),
  products: (ids: string[], signal?: AbortSignal) =>
    getJSON<ProductsResponse>(`/products?ids=${ids.map(enc).join(',')}`, signal).then((r) => r.products),
  cart: (signal?: AbortSignal) => getJSON<CartResponse>('/cart', signal),
  mutateCart: (req: CartMutationRequest) => sendJSON<CartResponse>('POST', '/cart/mutate', req),
  order: (req: OrderRequest) => sendJSON<OrderResponse>('POST', '/orders', req),
  compare: (productIds: string[], focus?: string) => sendJSON<Comparison>('POST', '/compare', { product_ids: productIds, focus: focus ?? null }),
  preference: (userId: string, signal?: AbortSignal) => getJSON<UserPreference>(`/preferences/${enc(userId)}`, signal),
  putPreference: (userId: string, body: PreferenceRequest) => sendJSON<UserPreference>('PUT', `/preferences/${enc(userId)}`, body),
  undoPreference: (userId: string, undoToken: string) =>
    sendJSON<PreferenceUndoResponse>('POST', `/preferences/${enc(userId)}/undo`, { undo_token: undoToken }),
  title: (userText: string, assistantText?: string) =>
    sendJSON<TitleResponse>('POST', '/title', { user_text: userText, assistant_text: assistantText ?? null }),
  suggestions: (signal?: AbortSignal) => getJSON<SuggestionsResponse>('/suggestions', signal),
}
