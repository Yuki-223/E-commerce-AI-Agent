/**
 * Mock persistence in localStorage, ported from store/cart_store.py and
 * store/user_memory_store.py so mutations behave like the SQLite stores.
 */
import type { CartLine, CartSnapshot, Order, UserPreference } from '../api/types'
import { getProductDetail } from './catalog'

const KEY = 'cartpilot.mock.'

function load<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(KEY + name)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function save(name: string, value: unknown) {
  try {
    localStorage.setItem(KEY + name, JSON.stringify(value))
  } catch {
    /* storage full or blocked: keep the in-memory result */
  }
}

/** Python round(x, 2) for cent-precision sums. */
export const round2 = (n: number) => Math.round(n * 100) / 100

// ---------------------------------------------------------------------------
// Cart (single demo user, like DEMO_USER_ID in cart_store.py)
// ---------------------------------------------------------------------------

interface StoredLine {
  cart_item_id: number
  product_id: string
  sku_id: string
  options: Record<string, string>
  quantity: number
  unit_price: number
  selected: boolean
}

interface StoredCart {
  next_id: number
  lines: StoredLine[]
}

export class CartNotFoundError extends Error {}

/** store/cart_store.py DEFAULT_ADDRESS. */
export const DEFAULT_ADDRESS = '默认地址（北京市朝阳区示例路 1 号 · 收货人：Demo User · 138****0000）'

const readCart = () => load<StoredCart>('cart', { next_id: 1, lines: [] })
const writeCart = (c: StoredCart) => save('cart', c)

function toLine(s: StoredLine): CartLine {
  return {
    cart_item_id: s.cart_item_id,
    product_id: s.product_id,
    sku_id: s.sku_id,
    title: getProductDetail(s.product_id)?.title ?? s.product_id,
    options: s.options,
    quantity: s.quantity,
    unit_price: s.unit_price,
    subtotal: round2(s.unit_price * s.quantity),
    selected: s.selected,
  }
}

export const cartStore = {
  listItems(): CartLine[] {
    return readCart().lines.sort((a, b) => a.cart_item_id - b.cart_item_id).map(toLine)
  },

  /** add_product: cheapest active SKU when sku_id is absent; same SKU adds quantity. */
  addProduct(productId: string, skuId?: string | null, quantity = 1): CartLine {
    if (quantity <= 0) quantity = 1
    const detail = getProductDetail(productId)
    const sku = skuId ? detail?.skus.find((s) => s.sku_id === skuId) : detail?.skus[0]
    if (!detail || !sku) throw new CartNotFoundError(`商品 ${productId} 没有可购买的 SKU`)
    const cart = readCart()
    let line = cart.lines.find((l) => l.sku_id === sku.sku_id)
    if (line) {
      line.quantity += quantity
      line.selected = true
    } else {
      line = {
        cart_item_id: cart.next_id++,
        product_id: productId,
        sku_id: sku.sku_id,
        options: { ...sku.properties },
        quantity,
        unit_price: sku.price,
        selected: true,
      }
      cart.lines.push(line)
    }
    writeCart(cart)
    return toLine(line)
  },

  /** set_quantity: non-positive removes and returns null. */
  setQuantity(cartItemId: number, quantity: number): CartLine | null {
    if (quantity <= 0) {
      this.removeItem(cartItemId)
      return null
    }
    const cart = readCart()
    const line = cart.lines.find((l) => l.cart_item_id === cartItemId)
    if (!line) throw new CartNotFoundError(`购物车行 ${cartItemId} 不存在`)
    line.quantity = quantity
    writeCart(cart)
    return toLine(line)
  },

  removeItem(cartItemId: number): boolean {
    const cart = readCart()
    const before = cart.lines.length
    cart.lines = cart.lines.filter((l) => l.cart_item_id !== cartItemId)
    writeCart(cart)
    return cart.lines.length < before
  },

  clear(): number {
    const cart = readCart()
    const n = cart.lines.length
    writeCart({ ...cart, lines: [] })
    return n
  },

  /** A line for build_direct_order: the SKU at its price, never written to the cart. */
  directLine(productId: string, skuId: string | null | undefined, quantity: number): CartLine {
    const detail = getProductDetail(productId)
    const sku = skuId ? detail?.skus.find((s) => s.sku_id === skuId) : detail?.skus[0]
    if (!detail || !sku) throw new CartNotFoundError(`商品 ${productId} 没有可购买的 SKU`)
    const unit = sku.price
    const qty = Math.max(1, quantity)
    return toLine({ cart_item_id: 0, product_id: productId, sku_id: sku.sku_id, options: { ...sku.properties }, quantity: qty, unit_price: unit, selected: true })
  },

  /** build_order(cart_item_ids=…) and build_direct_order: an order id plus the lines bought. */
  order(lines: CartLine[]): Order {
    return {
      order_id: `ord_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`,
      address: DEFAULT_ADDRESS,
      lines,
      item_count: lines.reduce((n, l) => n + l.quantity, 0),
      total: round2(lines.reduce((n, l) => n + l.subtotal, 0)),
    }
  },

  snapshot(): { cart: CartSnapshot } {
    const lines = this.listItems()
    return {
      cart: {
        lines,
        item_count: lines.reduce((n, l) => n + l.quantity, 0),
        total: round2(lines.reduce((n, l) => n + l.subtotal, 0)),
      },
    }
  },
}

// ---------------------------------------------------------------------------
// Preferences + undo tokens (user_memory_store.py)
// ---------------------------------------------------------------------------

export function emptyPreference(userId: string): UserPreference {
  return {
    user_id: userId,
    personalization_enabled: true,
    budget_min: null,
    budget_max: null,
    price_tier: null,
    favorite_categories: [],
    brand_include: [],
    brand_exclude: [],
    preference_keywords: [],
    style_tags: [],
    category_specific: {},
    preference_note: null,
    notes: null,
  }
}

/** UserPreference.from_dict: keep known fields only, user_id from the path. */
export function preferenceFromDict(userId: string, data: Record<string, unknown>): UserPreference {
  const base = emptyPreference(userId)
  const out: Record<string, unknown> = { ...base }
  for (const key of Object.keys(base)) {
    if (key !== 'user_id' && key in data) out[key] = data[key]
  }
  return out as unknown as UserPreference
}

interface UndoEntry {
  user_id: string
  field: string
  value: unknown
  before: UserPreference
  used: boolean
}

export interface PreferenceUpdate {
  field: string
  value: unknown
  message: string
  source?: string
}

const LIST_FIELDS = new Set(['favorite_categories', 'brand_include', 'brand_exclude', 'style_tags', 'preference_keywords'])
const SCALAR_FIELDS = new Set(['budget_min', 'budget_max', 'price_tier', 'notes', 'preference_note', 'personalization_enabled'])

function applyToPreference(p: UserPreference, u: PreferenceUpdate): boolean {
  const rec = p as unknown as Record<string, unknown>
  if (LIST_FIELDS.has(u.field)) {
    const items = rec[u.field] as string[]
    let changed = false
    for (let item of Array.isArray(u.value) ? u.value : [u.value]) {
      if (typeof item === 'string') item = item.trim()
      if (item && !items.includes(item as string)) {
        items.push(item as string)
        changed = true
      }
    }
    return changed
  }
  if (SCALAR_FIELDS.has(u.field)) {
    if (rec[u.field] === u.value) return false
    rec[u.field] = u.value
    return true
  }
  if (u.field === 'budget_range' && u.value && typeof u.value === 'object') {
    const v = u.value as { budget_min?: number; budget_max?: number }
    let changed = false
    if (p.budget_min !== (v.budget_min ?? null)) {
      p.budget_min = v.budget_min ?? null
      changed = true
    }
    if (p.budget_max !== (v.budget_max ?? null)) {
      p.budget_max = v.budget_max ?? null
      changed = true
    }
    return changed
  }
  return false
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const preferenceStore = {
  get(userId: string): UserPreference {
    const all = load<Record<string, UserPreference>>('preferences', {})
    return all[userId] ? preferenceFromDict(userId, all[userId] as unknown as Record<string, unknown>) : emptyPreference(userId)
  },

  put(p: UserPreference): UserPreference {
    const all = load<Record<string, UserPreference>>('preferences', {})
    all[p.user_id] = p
    save('preferences', all)
    return p
  },

  /** apply_update: returns the memory_update SSE payload, or null for a no-op. */
  applyUpdate(userId: string, u: PreferenceUpdate) {
    const before = this.get(userId)
    const after = structuredClone(before)
    if (!applyToPreference(after, u)) return null
    const token = `undo_${randomToken()}`
    this.put(after)
    const undo = load<Record<string, UndoEntry>>('undo', {})
    undo[token] = { user_id: userId, field: u.field, value: u.value, before, used: false }
    save('undo', undo)
    return { message: u.message, field: u.field, value: u.value, source: u.source ?? 'auto', undo_token: token, preference: after }
  },

  undo(userId: string, token: string) {
    const undo = load<Record<string, UndoEntry>>('undo', {})
    const entry = undo[token]
    if (!entry || entry.used || entry.user_id !== userId) return null
    this.put(entry.before)
    entry.used = true
    save('undo', undo)
    return { message: '已撤销刚才记住的偏好', field: entry.field, value: entry.value, preference: entry.before }
  },
}

// ---------------------------------------------------------------------------
// Agent session memory (what SqliteSessionStore keeps between turns)
// ---------------------------------------------------------------------------

export interface MockSession {
  session_id: string
  last_products: { product_id: string; title: string }[]
  pending_add?: { product_id: string; title: string; quantity?: number }
}

export const sessionStore = {
  getOrCreate(id?: string | null): MockSession {
    const all = load<Record<string, MockSession>>('sessions', {})
    if (id && all[id]) return all[id]
    const s: MockSession = { session_id: id || crypto.randomUUID(), last_products: [] }
    return s
  },
  save(s: MockSession) {
    const all = load<Record<string, MockSession>>('sessions', {})
    all[s.session_id] = s
    save('sessions', all)
  },
}
