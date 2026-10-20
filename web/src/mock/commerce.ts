/**
 * In-browser fake of api/auth.py, api/orders.py and api/merchant.py, persisted in
 * localStorage like mock/state.ts. Same paths, status codes and JSON shapes as the
 * backend. Simplifications: the mock cart stays one shared cart (the backend binds
 * it per account), tokens are unsigned, and merchant-published products live only
 * in the console, so the scripted chat cannot recommend or sell them.
 */
import type {
  Account, Address, AddressRequest, CartLine, MerchantProduct, MerchantStats, Order, OrderRecord, OrderStatus, ProductCreateRequest, SkuBody,
} from '../api/types'
import { round2 } from './state'

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
    /* storage full or blocked */
  }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const httpError = (status: number, message: string) => json({ code: `API_HTTP_${status}`, message, retryable: status >= 500, traceID: null }, status)
const hex = (n: number) => crypto.randomUUID().replaceAll('-', '').slice(0, n)
const now = () => new Date().toISOString().slice(0, 19).replace('T', ' ')

export const DEMO_USER_ID = 'demo_user'

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

interface StoredAccount extends Account {
  password: string
  shop_name: string | null
  shop_description: string
}

const accounts = () => load<StoredAccount[]>('accounts', [])
const publicAccount = ({ password: _p, shop_name: _s, shop_description: _d, ...a }: StoredAccount): Account => a

function accountFromAuth(init: RequestInit): StoredAccount | null | Response {
  const header = new Headers(init.headers).get('Authorization')
  if (!header) return null
  const userId = header.replace(/^Bearer\s+/i, '').replace(/^mock\./, '')
  return accounts().find((a) => a.user_id === userId) ?? httpError(401, '登录已失效，请重新登录')
}

/** shopper_id in api/auth.py: the account, else the shared demo shopper. */
export function shopperId(init: RequestInit): string | Response {
  const a = accountFromAuth(init)
  if (a instanceof Response) return a
  return a?.user_id ?? DEMO_USER_ID
}

function register(body: { username?: string; password?: string; nickname?: string | null; role?: string; shop_name?: string | null }): Response {
  const username = (body.username ?? '').trim()
  if (!/^[A-Za-z0-9_\-.@一-鿿]{3,32}$/.test(username)) return httpError(400, '用户名需为 3-32 位字母、数字、中文或 _-.@')
  if ((body.password ?? '').length < 6) return httpError(400, '密码至少 6 位')
  if (body.role !== 'customer' && body.role !== 'merchant') return httpError(400, '只能注册顾客或商家账号')
  if (body.role === 'merchant' && !(body.shop_name ?? '').trim()) return httpError(400, '商家注册需要填写店铺名称')
  const all = accounts()
  if (all.some((a) => a.username === username)) return httpError(400, '用户名已被注册')
  const account: StoredAccount = {
    user_id: `u_${hex(12)}`,
    username,
    nickname: (body.nickname ?? '').trim() || username,
    role: body.role,
    merchant_id: body.role === 'merchant' ? `m_${hex(12)}` : null,
    password: body.password!,
    shop_name: body.role === 'merchant' ? body.shop_name!.trim() : null,
    shop_description: '',
  }
  save('accounts', [...all, account])
  return json({ token: `mock.${account.user_id}`, account: publicAccount(account) })
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: '待支付',
  paid: '待发货',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
  refund_requested: '退款中',
  refunded: '已退款',
}

type StoredOrder = Omit<OrderRecord, 'status_label' | 'item_count'> & { prev_status: OrderStatus | null }

const readOrders = () => load<StoredOrder[]>('orders', [])
const writeOrders = (o: StoredOrder[]) => save('orders', o)

function present(o: StoredOrder): OrderRecord {
  const { prev_status: _p, ...rest } = o
  return { ...rest, status_label: STATUS_LABELS[o.status], item_count: o.items.reduce((n, i) => n + i.quantity, 0) }
}

/** OrderStore.create_orders for the mock catalog: one platform-operated order. */
export function createOrder(userId: string, lines: CartLine[], address: string): Order {
  const order: StoredOrder = {
    order_id: `ord_${hex(12)}`,
    checkout_id: `co_${hex(12)}`,
    user_id: userId,
    merchant_id: null,
    merchant_name: 'CartPilot 自营',
    status: 'pending_payment',
    prev_status: null,
    total: round2(lines.reduce((n, l) => n + l.subtotal, 0)),
    address,
    items: lines.map((l) => ({ product_id: l.product_id, sku_id: l.sku_id, title: l.title, options: l.options, quantity: l.quantity, unit_price: l.unit_price, subtotal: l.subtotal })),
    carrier: null,
    tracking_no: null,
    refund_reason: null,
    created_at: now(),
    paid_at: null,
    shipped_at: null,
    completed_at: null,
    cancelled_at: null,
  }
  writeOrders([order, ...readOrders()])
  return { order_id: order.order_id, order_ids: [order.order_id], status: 'pending_payment', address, lines, item_count: present(order).item_count, total: order.total }
}

function transition(
  orderId: string,
  visible: (o: StoredOrder) => boolean,
  from: OrderStatus[],
  to: OrderStatus | null,
  patch: Partial<StoredOrder> = {},
): Response {
  const all = readOrders()
  const o = all.find((x) => x.order_id === orderId)
  if (!o || !visible(o)) return httpError(404, '订单不存在')
  if (!from.includes(o.status)) return httpError(409, `订单当前状态为「${STATUS_LABELS[o.status]}」，不能执行该操作`)
  const target = to ?? o.prev_status ?? 'paid'
  Object.assign(o, patch, { prev_status: to === 'refund_requested' ? o.status : null, status: target })
  writeOrders(all)
  return json({ order: present(o) })
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

const readAddresses = () => load<Address[]>('addresses', [])
const withText = (a: Omit<Address, 'text'>): Address => ({ ...a, text: `${`${a.region} ${a.detail}`.trim()} · 收货人：${a.recipient} · ${a.phone}` })

export function defaultAddressText(userId: string): string | null {
  const mine = readAddresses().filter((a) => a.user_id === userId)
  return (mine.find((a) => a.is_default) ?? mine[0])?.text ?? null
}

export function addressText(userId: string, id: number): string | null {
  return readAddresses().find((a) => a.user_id === userId && a.address_id === id)?.text ?? null
}

function saveAddresses(all: Address[], userId: string, defaultId?: number) {
  const mine = all.filter((a) => a.user_id === userId)
  if (defaultId !== undefined) for (const a of mine) a.is_default = a.address_id === defaultId
  if (mine.length && !mine.some((a) => a.is_default)) mine[0].is_default = true
  save('addresses', all.map((a) => withText(a)))
}

// ---------------------------------------------------------------------------
// Merchant catalog
// ---------------------------------------------------------------------------

const readProducts = () => load<MerchantProduct[]>('merchantProducts', [])

function finish(p: MerchantProduct): MerchantProduct {
  const active = p.skus.filter((s) => s.status === 'active')
  return { ...p, base_price: active.length ? Math.min(...active.map((s) => s.price)) : p.base_price, total_stock: active.reduce((n, s) => n + s.stock_qty, 0), updated_at: now() }
}

function seller(init: RequestInit): StoredAccount | Response {
  const a = accountFromAuth(init)
  if (a instanceof Response) return a
  if (!a) return httpError(401, '请先登录')
  if (a.role !== 'merchant' || !a.merchant_id) return httpError(403, '仅商家账号可以访问商家后台')
  return a
}

function stats(merchantId: string): MerchantStats {
  const orders = readOrders().filter((o) => o.merchant_id === merchantId)
  const products = readProducts().filter((p) => p.merchant_id === merchantId)
  const sold = orders.filter((o) => ['paid', 'shipped', 'completed', 'refund_requested'].includes(o.status))
  const counts = Object.fromEntries(Object.keys(STATUS_LABELS).map((s) => [s, orders.filter((o) => o.status === s).length])) as Record<OrderStatus, number>
  return {
    status_counts: counts,
    order_count: orders.length,
    paid_order_count: sold.length,
    revenue: round2(sold.reduce((n, o) => n + o.total, 0)),
    top_products: [],
    daily_sales: [],
    product_count: products.length,
    active_product_count: products.filter((p) => p.status === 'active').length,
    low_stock: products.filter((p) => p.status === 'active' && p.total_stock <= 10).map((p) => ({ product_id: p.product_id, title: p.title, total_stock: p.total_stock })),
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function body<T>(init: RequestInit): Promise<T> {
  return JSON.parse(typeof init.body === 'string' ? init.body : '{}') as T
}

/** Answers /auth, /orders/{id}…, /addresses and /merchant paths; `null` when the path is not one of them. */
export async function commerceFetch(method: string, url: URL, init: RequestInit): Promise<Response | null> {
  const p = url.pathname
  let m: RegExpMatchArray | null

  if (method === 'POST' && p === '/auth/register') return register(await body(init))
  if (method === 'POST' && p === '/auth/login') {
    const { username, password } = await body<{ username: string; password: string }>(init)
    const a = accounts().find((x) => x.username === (username ?? '').trim() && x.password === password)
    return a ? json({ token: `mock.${a.user_id}`, account: publicAccount(a) }) : httpError(401, '用户名或密码错误')
  }
  if (method === 'GET' && p === '/auth/me') {
    const a = accountFromAuth(init)
    if (a instanceof Response) return a
    if (!a) return httpError(401, '请先登录')
    const merchant = a.merchant_id ? { merchant_id: a.merchant_id, owner_user_id: a.user_id, name: a.shop_name, description: a.shop_description, status: 'active' } : null
    return json({ account: publicAccount(a), merchant })
  }

  if (p === '/orders' && method === 'GET') {
    const uid = shopperId(init)
    if (uid instanceof Response) return uid
    const status = url.searchParams.get('status')
    return json({ orders: readOrders().filter((o) => o.user_id === uid && (!status || o.status === status)).map(present) })
  }
  if ((m = p.match(/^\/orders\/([^/]+)(?:\/(pay|cancel|confirm|refund))?$/))) {
    const uid = shopperId(init)
    if (uid instanceof Response) return uid
    const id = decodeURIComponent(m[1])
    const mine = (o: StoredOrder) => o.user_id === uid
    if (method === 'GET' && !m[2]) {
      const o = readOrders().find((x) => x.order_id === id && mine(x))
      return o ? json({ order: present(o) }) : httpError(404, '订单不存在')
    }
    if (method === 'POST' && m[2] === 'pay') return transition(id, mine, ['pending_payment'], 'paid', { paid_at: now() })
    if (method === 'POST' && m[2] === 'cancel') return transition(id, mine, ['pending_payment'], 'cancelled', { cancelled_at: now() })
    if (method === 'POST' && m[2] === 'confirm') return transition(id, mine, ['shipped'], 'completed', { completed_at: now() })
    if (method === 'POST' && m[2] === 'refund') {
      const { reason } = await body<{ reason?: string }>(init)
      return transition(id, mine, ['paid', 'shipped'], 'refund_requested', { refund_reason: (reason ?? '').trim() || '未填写原因' })
    }
  }

  if ((m = p.match(/^\/addresses(?:\/(\d+))?$/))) {
    const uid = shopperId(init)
    if (uid instanceof Response) return uid
    const all = readAddresses()
    if (method === 'GET' && !m[1]) {
      const mine = all.filter((a) => a.user_id === uid).sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.address_id - b.address_id)
      return json({ addresses: mine })
    }
    if (method === 'POST' && !m[1]) {
      const req = await body<AddressRequest>(init)
      const address = withText({ ...req, address_id: Math.max(0, ...all.map((a) => a.address_id)) + 1, user_id: uid, is_default: false })
      all.push(address)
      saveAddresses(all, uid, req.is_default ? address.address_id : undefined)
      return json({ address: readAddresses().find((a) => a.address_id === address.address_id) })
    }
    const id = Number(m[1])
    const target = all.find((a) => a.user_id === uid && a.address_id === id)
    if (!target) return httpError(404, '地址不存在')
    if (method === 'PUT') {
      const { is_default, ...patch } = await body<Partial<AddressRequest>>(init)
      Object.assign(target, Object.fromEntries(Object.entries(patch).filter(([, v]) => v != null)))
      saveAddresses(all, uid, is_default ? id : undefined)
      return json({ address: readAddresses().find((a) => a.address_id === id) })
    }
    if (method === 'DELETE') {
      saveAddresses(all.filter((a) => a !== target), uid)
      return json({ status: 'deleted' })
    }
  }

  if (p.startsWith('/merchant/')) {
    const a = seller(init)
    if (a instanceof Response) return a
    const mid = a.merchant_id!
    if (p === '/merchant/shop') {
      if (method === 'PUT') {
        const req = await body<{ name?: string; description?: string }>(init)
        save('accounts', accounts().map((x) => (x.user_id === a.user_id ? { ...x, shop_name: req.name?.trim() || x.shop_name, shop_description: req.description ?? x.shop_description } : x)))
      }
      const fresh = accounts().find((x) => x.user_id === a.user_id)!
      return json({ admin: false, merchant: { merchant_id: mid, owner_user_id: a.user_id, name: fresh.shop_name, description: fresh.shop_description, status: 'active' } })
    }
    if (method === 'GET' && p === '/merchant/stats') return json(stats(mid))
    if (method === 'GET' && p === '/merchant/orders') {
      const status = url.searchParams.get('status')
      return json({ orders: readOrders().filter((o) => o.merchant_id === mid && (!status || o.status === status)).map(present) })
    }
    if ((m = p.match(/^\/merchant\/orders\/([^/]+)\/(ship|refund\/approve|refund\/reject)$/)) && method === 'POST') {
      const id = decodeURIComponent(m[1])
      const ours = (o: StoredOrder) => o.merchant_id === mid
      if (m[2] === 'ship') {
        const { carrier, tracking_no } = await body<{ carrier: string; tracking_no: string }>(init)
        return transition(id, ours, ['paid'], 'shipped', { carrier, tracking_no, shipped_at: now() })
      }
      return m[2] === 'refund/approve' ? transition(id, ours, ['refund_requested'], 'refunded', { cancelled_at: now() }) : transition(id, ours, ['refund_requested'], null)
    }

    const products = readProducts()
    if (p === '/merchant/products') {
      if (method === 'GET') return json({ products: products.filter((x) => x.merchant_id === mid) })
      if (method === 'POST') {
        const req = await body<ProductCreateRequest>(init)
        const id = `p_m_${hex(10)}`
        const product = finish({
          product_id: id,
          title: req.title.trim(),
          brand: req.brand.trim(),
          category: req.category.trim(),
          sub_category: req.sub_category?.trim() || null,
          base_price: 0,
          image_path: null,
          image_url: req.image_url.trim(),
          status: 'active',
          merchant_id: mid,
          updated_at: now(),
          description: req.description ?? '',
          skus: req.skus.map((s: SkuBody, i) => ({ sku_id: `${id}_s${i + 1}`, properties: s.properties, price: s.price, stock_qty: s.stock_qty, status: s.status ?? 'active' })),
          total_stock: 0,
          sold_qty: 0,
        })
        save('merchantProducts', [product, ...products])
        return json({ product })
      }
    }
    if ((m = p.match(/^\/merchant\/products\/([^/]+)(?:\/(status|skus))?$/))) {
      const product = products.find((x) => x.product_id === decodeURIComponent(m![1]) && x.merchant_id === mid)
      if (!product) return httpError(404, '商品不存在或不属于你的店铺')
      if (method === 'PUT' && !m[2]) {
        const req = await body<Record<string, string | undefined>>(init)
        for (const k of ['title', 'brand', 'category', 'sub_category', 'image_url', 'description'] as const) if (req[k] != null) (product as unknown as Record<string, string>)[k] = req[k]!
      } else if (method === 'POST' && m[2] === 'status') {
        product.status = (await body<{ status: 'active' | 'inactive' }>(init)).status
      } else if (method === 'PUT' && m[2] === 'skus') {
        const sku = await body<SkuBody>(init)
        const existing = product.skus.find((s) => s.sku_id === sku.sku_id)
        if (existing) Object.assign(existing, { properties: sku.properties, price: sku.price, stock_qty: sku.stock_qty, status: sku.status ?? 'active' })
        else product.skus.push({ sku_id: `${product.product_id}_s${product.skus.length + 1}_${hex(4)}`, properties: sku.properties, price: sku.price, stock_qty: sku.stock_qty, status: sku.status ?? 'active' })
      } else if (method !== 'GET') {
        return null
      }
      const saved = finish(product)
      save('merchantProducts', products.map((x) => (x.product_id === saved.product_id ? saved : x)))
      return json({ product: saved })
    }
  }
  return null
}
