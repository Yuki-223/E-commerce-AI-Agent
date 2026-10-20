/**
 * Wire types for the FastAPI backend. Field names and casing match the JSON the
 * backend emits byte for byte (backend/api/main.py, backend/api/products.py,
 * backend/agent/*). The mock layer produces exactly these shapes, so switching
 * VITE_USE_MOCK off changes nothing above this file.
 */

// ---------------------------------------------------------------------------
// Products: GET /products/{id}, GET /products?ids=  (api/products.py)
// ---------------------------------------------------------------------------

export interface Money {
  currency: 'CNY'
  amountMinor: number
  display: string
}

export type Availability = 'inStock' | 'lowStock' | 'outOfStock' | 'unknown'

export interface SpecOption {
  id: string
  label: string
  isAvailable: boolean
}

export interface Specification {
  id: string
  name: string
  options: SpecOption[]
}

export interface Sku {
  id: string
  selectedOptions: Record<string, string>
  price: Money
  availability: 'inStock' | 'outOfStock'
  stockCount: number
}

export interface Review {
  id: string
  nickname: string
  rating: number
  content: string
  polarity: 'positive' | 'neutral' | 'negative'
}

export interface Evidence {
  id: string
  sourceType: 'productDetail' | 'userReview'
  title: string
  snippet: string
  score: number | null
  updatedAt: null
}

export interface Product {
  productID: string
  title: string
  category: string
  brand: string
  imageURL: string | null
  detailURL: null
  price: Money
  originalPrice: null
  availability: Availability
  summary: string | null
  tags: string[]
  specifications: Specification[]
  skus: Sku[]
  reviews: Review[]
  evidence: Evidence[]
  /** Ingredients and safety flags; absent from older backends and merchant products. */
  attributes?: ProductAttributes
  updatedAt: null
}

export interface ProductsResponse {
  requestID: 'products_by_id'
  products: Product[]
}

/** Error body produced by main.py's HTTPException handler. */
export interface ApiErrorPayload {
  code: string
  message: string
  retryable: boolean
  traceID: string | null
}

// ---------------------------------------------------------------------------
// Cart: GET /cart, POST /cart/mutate  (store/cart_store.py CartLine.to_dict)
// ---------------------------------------------------------------------------

export interface CartLine {
  cart_item_id: number
  product_id: string
  sku_id: string
  title: string
  options: Record<string, string>
  quantity: number
  unit_price: number
  subtotal: number
  selected: boolean
}

export interface CartSnapshot {
  lines: CartLine[]
  item_count: number
  total: number
}

export interface CartResponse {
  cart: CartSnapshot
}

export type CartMutationAction = 'add' | 'updateQuantity' | 'updateSpecification' | 'remove'

/** Mirrors CartMutationRequest in main.py (camelCase there too). */
export interface CartMutationRequest {
  action: CartMutationAction
  productID?: string | null
  skuID?: string | null
  cartItemID?: string | null
  selectedOptions?: Record<string, string>
  quantity?: number | null
  selectedCartItemIDs?: string[]
}

// ---------------------------------------------------------------------------
// Compare: POST /compare  (agent/comparison.py build_comparison)
// ---------------------------------------------------------------------------

export interface CompareRequest {
  product_ids: string[]
  focus?: string | null
}

export interface ComparisonProduct {
  product_id: string
  title: string
  brand: string
  price: number
  image_url: string | null
  /** Not returned yet; added to _product_header in phase two. */
  tagline?: string
}

export interface ComparisonRow {
  label: string
  values: string[]
  highlight: number | null
}

export interface Comparison {
  title: string
  products: ComparisonProduct[]
  rows: ComparisonRow[]
  recommendation: string
}

// ---------------------------------------------------------------------------
// Preferences: GET/PUT /preferences/{user_id}, POST .../undo  (store/user_memory_store.py)
// ---------------------------------------------------------------------------

export interface UserPreference {
  user_id: string
  personalization_enabled: boolean
  budget_min: number | null
  budget_max: number | null
  price_tier: string | null
  favorite_categories: string[]
  brand_include: string[]
  brand_exclude: string[]
  preference_keywords: string[]
  style_tags: string[]
  category_specific: Record<string, Record<string, unknown>>
  preference_note: string | null
  notes: string | null
  /** Absent from backends before the women's supply profile. */
  body_profile?: BodyProfile
  /** search/safety.py SAFETY_FLAGS keys. */
  safety_flags?: SafetyFlag[]
  allergens_avoid?: string[]
}

export type SafetyFlag = 'pregnancy' | 'sensitive_skin' | 'no_caffeine' | 'vegan'

/** UserPreference.body_profile; drives size and shade preselection (store/sku_match.py). */
export interface BodyProfile {
  skin_type?: string
  skin_tone?: 'cool' | 'neutral' | 'warm'
  clothing_size?: string
  bra_size?: string
  shoe_size?: string
}

/** Product.attributes (products.attributes_json). */
export interface ProductAttributes {
  ingredients?: string[]
  allergens?: string[]
  pregnancy?: 'safe' | 'caution' | 'avoid'
  pregnancy_note?: string
  caffeine?: boolean
  fragrance?: boolean
  alcohol?: boolean
  vegan?: boolean
  tags?: string[]
  cycle_phases?: ('menstrual' | 'follicular' | 'ovulatory' | 'luteal')[]
}

/** PUT body: PreferenceRequest has every field except user_id. */
export type PreferenceRequest = Omit<UserPreference, 'user_id'>

export interface PreferenceUndoResponse {
  message: string
  field: string
  value: unknown
  preference: UserPreference
}

// ---------------------------------------------------------------------------
// Misc REST
// ---------------------------------------------------------------------------

export interface HealthResponse {
  status: 'ok'
}

export interface TitleRequest {
  user_text: string
  assistant_text?: string | null
}

export interface TitleResponse {
  title: string
}

export interface SuggestionsResponse {
  categories: string[]
  hot_searches: string[]
}

// ---------------------------------------------------------------------------
// Chat: POST /chat/stream (SSE)  — main.py chat_stream + agent/orchestrator.py
// ---------------------------------------------------------------------------

export interface ChatRequest {
  query: string
  session_id?: string | null
  user_id?: string | null
  image_base64?: string | null
  image_url?: string | null
  /** Condition chips removed in the 思考过程 block; reruns the previous search without them. */
  drop_conditions?: string[]
}

export type StatusPhase = 'routing' | 'tool' | 'compose' | 'vision' | 'done'

export interface SessionEventData {
  session_id: string
}

export interface StatusEventData {
  phase: StatusPhase
  message: string
  tool?: string
}

export interface IntentDecision {
  tool: string
  rewritten_query: string
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
}

export interface MetaEventData {
  decision: IntentDecision
  trace: Record<string, unknown>
}

/** ToolResult.to_dict() in agent/tools/base.py. */
export interface ToolResultEventData<P = ToolPayload> {
  tool_name: string
  payload: P
  composer_hint?: string | null
  narrative_override?: string | null
  needs_composer?: boolean
}

export interface DoneEventData {
  timings: Record<string, number>
  narrative: string
  trace?: Record<string, unknown>
}

/** _apply_realtime_preference_updates → UserMemoryStore.apply_update return value. */
export interface MemoryUpdateEventData {
  message: string
  field: string
  value: unknown
  source: string
  undo_token: string
  preference: UserPreference
}

export interface ErrorEventData {
  message: string
}

/** Every event name chat_stream can write, in wire form. */
export type SseEvent =
  | { event: 'session'; data: SessionEventData }
  | { event: 'status'; data: StatusEventData }
  | { event: 'meta'; data: MetaEventData }
  | { event: 'tool_result'; data: ToolResultEventData }
  | { event: 'token'; data: string }
  | { event: 'memory_update'; data: MemoryUpdateEventData }
  | { event: 'done'; data: DoneEventData }
  | { event: 'error'; data: ErrorEventData }

export type SseEventName = SseEvent['event']

// --- tool_result payloads -------------------------------------------------

/** recommend.py _to_product_card + _attach_price_displays. */
export interface ProductCard {
  product_id: string
  title: string
  brand: string
  category: string
  sub_category: string | null
  price: number
  price_display?: string
}

export interface RecommendPayload {
  query?: string
  products: ProductCard[]
  action?: 'image_unrecognized'
  groups?: { label: string; products: ProductCard[] }[]
  summary?: Record<string, unknown>
  debug?: Record<string, unknown>
}

/**
 * OrderSummary.to_dict() in store/cart_store.py: one checkout. A checkout that
 * spans several shops creates several orders; order_ids lists them all.
 */
export interface Order {
  order_id: string
  /** Absent from backends before persisted orders. */
  order_ids?: string[]
  status?: OrderStatus
  address: string
  lines: CartLine[]
  item_count: number
  total: number
}

/** POST /orders: `items` orders now and leaves the cart; `cartItemIDs` checks out those lines. */
export interface OrderRequest {
  items?: { productID: string; skuID: string | null; quantity: number }[]
  cartItemIDs?: string[]
  address?: string | null
  /** An address-book entry; wins over `address`. */
  address_id?: number | null
  session_id?: string | null
}

export interface OrderResponse extends CartResponse {
  order: Order
}

/** One candidate SKU of an ask_spec question, with its SQLite price. */
export interface SpecSku {
  sku_id: string
  options: Record<string, string>
  price: number
  stock_qty?: number | null
}

export interface SpecDimension {
  name: string
  values: string[]
}

export type CartToolPayload =
  | {
      action: 'ask_spec'; product_id: string; title: string; dimensions: SpecDimension[]; options: Record<string, string[]>; resolution?: unknown
      /** Quantity taken from the conversation; absent from older backends. */
      quantity?: number
      skus?: SpecSku[]
      /** Options the backend preselected from the body profile (store/sku_match.py). */
      suggested_options?: Record<string, string>
    }
  | { action: 'add'; added: CartLine; cart: CartSnapshot; resolution?: unknown }
  | { action: 'set_quantity'; cart: CartSnapshot }
  | { action: 'remove'; removed: CartLine; cart: CartSnapshot }
  | { action: 'view'; cart: CartSnapshot }
  | { action: 'checkout'; order: Order }
  | { action: 'ask_which_product'; candidates: { product_id: string; title: string }[] }
  | { action: 'noop' }

export interface ComparePayload {
  action: 'compare'
  comparison: Comparison | null
}

export type ToolPayload = RecommendPayload | CartToolPayload | ComparePayload | Record<string, unknown>

/**
 * The composer's narrative. For recommend/refine/compare it is a JSON document
 * (composer.py SYSTEM_PROMPT); product_detail and narrative_override are plain text.
 */
export interface ComposerJson {
  opening: string
  items: { productId: string; description: string }[]
  followup: string[]
}

// ---------------------------------------------------------------------------
// Accounts: POST /auth/register, POST /auth/login, GET /auth/me  (api/auth.py)
// ---------------------------------------------------------------------------

export type AccountRole = 'customer' | 'merchant' | 'admin'

export interface Account {
  user_id: string
  username: string
  nickname: string
  role: AccountRole
  merchant_id: string | null
}

export interface AuthResponse {
  token: string
  account: Account
}

export interface RegisterRequest {
  username: string
  password: string
  nickname?: string | null
  role: 'customer' | 'merchant'
  shop_name?: string | null
}

export interface Merchant {
  merchant_id: string
  owner_user_id: string
  name: string
  description: string
  status: 'pending' | 'active' | 'suspended'
}

// ---------------------------------------------------------------------------
// Persisted orders: GET /orders, POST /orders/{id}/…  (store/order_store.py Order.to_dict)
// ---------------------------------------------------------------------------

export type OrderStatus = 'pending_payment' | 'paid' | 'shipped' | 'completed' | 'cancelled' | 'refund_requested' | 'refunded'

export interface OrderItem {
  product_id: string
  sku_id: string
  title: string
  options: Record<string, string>
  quantity: number
  unit_price: number
  subtotal: number
}

export interface OrderRecord {
  order_id: string
  checkout_id: string
  user_id: string
  merchant_id: string | null
  merchant_name: string
  status: OrderStatus
  status_label: string
  total: number
  item_count: number
  address: string
  items: OrderItem[]
  carrier: string | null
  tracking_no: string | null
  refund_reason: string | null
  created_at: string
  paid_at: string | null
  shipped_at: string | null
  completed_at: string | null
  cancelled_at: string | null
}

export interface OrdersResponse {
  orders: OrderRecord[]
}

export interface OrderRecordResponse {
  order: OrderRecord
}

// ---------------------------------------------------------------------------
// Address book: /addresses  (store/address_store.py Address.to_dict)
// ---------------------------------------------------------------------------

export interface Address {
  address_id: number
  user_id: string
  recipient: string
  phone: string
  region: string
  detail: string
  is_default: boolean
  /** The one-line snapshot an order stores. */
  text: string
}

export type AddressRequest = Pick<Address, 'recipient' | 'phone' | 'region' | 'detail' | 'is_default'>

// ---------------------------------------------------------------------------
// Merchant console: /merchant/*  (api/merchant.py, store/merchant_store.py)
// ---------------------------------------------------------------------------

export interface MerchantSku {
  sku_id: string
  properties: Record<string, string>
  price: number
  stock_qty: number
  status: 'active' | 'inactive'
}

export interface MerchantProduct {
  product_id: string
  title: string
  brand: string
  category: string
  sub_category: string | null
  base_price: number
  image_path: string | null
  image_url: string | null
  status: 'active' | 'inactive'
  merchant_id: string | null
  updated_at: string
  description: string
  skus: MerchantSku[]
  total_stock: number
  sold_qty: number
}

export interface SkuBody {
  sku_id?: string | null
  properties: Record<string, string>
  price: number
  stock_qty: number
  status?: 'active' | 'inactive'
}

export interface ProductCreateRequest {
  title: string
  brand: string
  category: string
  sub_category: string
  image_url: string
  description: string
  skus: SkuBody[]
}

export type ProductPatchRequest = Partial<Omit<ProductCreateRequest, 'skus'>>

export interface MerchantStats {
  status_counts: Record<OrderStatus, number>
  order_count: number
  paid_order_count: number
  revenue: number
  top_products: { product_id: string; title: string; quantity: number; sales: number }[]
  daily_sales: { day: string; sales: number; orders: number }[]
  product_count: number
  active_product_count: number
  low_stock: { product_id: string; title: string; total_stock: number }[]
}

export interface ShopResponse {
  merchant: Merchant | null
  admin: boolean
}
