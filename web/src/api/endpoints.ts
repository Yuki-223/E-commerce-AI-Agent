/** Typed REST calls, one per backend endpoint the web client uses. */
import { deleteJSON, getJSON, sendJSON } from './http'
import type {
  AddressRequest, Address, AuthResponse, CartMutationRequest, CartResponse, Comparison, OrderRequest, OrderResponse, HealthResponse,
  MerchantProduct, MerchantStats, OrderRecordResponse, OrdersResponse, OrderStatus, PreferenceRequest, PreferenceUndoResponse,
  Product, ProductCreateRequest, ProductPatchRequest, ProductsResponse, RegisterRequest, ShopResponse, SkuBody, SuggestionsResponse,
  TitleResponse, UserPreference, Account, Merchant,
} from './types'

const enc = encodeURIComponent
const statusQuery = (status?: OrderStatus | null) => (status ? `?status=${enc(status)}` : '')

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

  // Accounts
  login: (username: string, password: string) => sendJSON<AuthResponse>('POST', '/auth/login', { username, password }),
  register: (req: RegisterRequest) => sendJSON<AuthResponse>('POST', '/auth/register', req),
  me: (signal?: AbortSignal) => getJSON<{ account: Account; merchant: Merchant | null }>('/auth/me', signal),

  // Shopper orders and addresses
  orders: (status?: OrderStatus | null, signal?: AbortSignal) => getJSON<OrdersResponse>(`/orders${statusQuery(status)}`, signal),
  orderAction: (orderId: string, action: 'pay' | 'cancel' | 'confirm') =>
    sendJSON<OrderRecordResponse>('POST', `/orders/${enc(orderId)}/${action}`, {}),
  requestRefund: (orderId: string, reason: string) => sendJSON<OrderRecordResponse>('POST', `/orders/${enc(orderId)}/refund`, { reason }),
  addresses: (signal?: AbortSignal) => getJSON<{ addresses: Address[] }>('/addresses', signal),
  createAddress: (req: AddressRequest) => sendJSON<{ address: Address }>('POST', '/addresses', req),
  updateAddress: (id: number, req: Partial<AddressRequest>) => sendJSON<{ address: Address }>('PUT', `/addresses/${id}`, req),
  deleteAddress: (id: number) => deleteJSON<{ status: string }>(`/addresses/${id}`),

  // Merchant console
  shop: (signal?: AbortSignal) => getJSON<ShopResponse>('/merchant/shop', signal),
  updateShop: (body: { name?: string; description?: string }) => sendJSON<ShopResponse>('PUT', '/merchant/shop', body),
  merchantStats: (signal?: AbortSignal) => getJSON<MerchantStats>('/merchant/stats', signal),
  merchantProducts: (signal?: AbortSignal) => getJSON<{ products: MerchantProduct[] }>('/merchant/products', signal),
  createProduct: (req: ProductCreateRequest) => sendJSON<{ product: MerchantProduct }>('POST', '/merchant/products', req),
  updateProduct: (id: string, req: ProductPatchRequest) => sendJSON<{ product: MerchantProduct }>('PUT', `/merchant/products/${enc(id)}`, req),
  setProductStatus: (id: string, status: 'active' | 'inactive') =>
    sendJSON<{ product: MerchantProduct }>('POST', `/merchant/products/${enc(id)}/status`, { status }),
  upsertSku: (id: string, sku: SkuBody) => sendJSON<{ product: MerchantProduct }>('PUT', `/merchant/products/${enc(id)}/skus`, sku),
  merchantOrders: (status?: OrderStatus | null, signal?: AbortSignal) =>
    getJSON<OrdersResponse>(`/merchant/orders${statusQuery(status)}`, signal),
  shipOrder: (orderId: string, carrier: string, trackingNo: string) =>
    sendJSON<OrderRecordResponse>('POST', `/merchant/orders/${enc(orderId)}/ship`, { carrier, tracking_no: trackingNo }),
  decideRefund: (orderId: string, decision: 'approve' | 'reject') =>
    sendJSON<OrderRecordResponse>('POST', `/merchant/orders/${enc(orderId)}/refund/${decision}`, {}),
}
