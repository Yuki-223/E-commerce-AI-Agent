/**
 * In-browser fake of backend/api/main.py. mockFetch(path, init) answers the same
 * paths, status codes and JSON bodies as FastAPI, and /chat/stream returns a real
 * text/event-stream body, so the client parses mock and real responses identically.
 */
import type { CartMutationRequest, ChatRequest, CompareRequest, TitleRequest } from '../api/types'
import { scriptTurn } from './agent'
import { buildComparison, catalog, getProductDetail, productPayload, type ProductDetail } from './catalog'
import { mockCtl } from './controls'
import { CartNotFoundError, cartStore, preferenceFromDict, preferenceStore } from './state'

const sleep = (ms: number, signal?: AbortSignal | null) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** main.py http_exception_handler for a plain-string HTTPException detail. */
const httpError = (status: number, message: string) =>
  json({ code: `API_HTTP_${status}`, message, retryable: status >= 500, traceID: null }, status)

/** Unhandled exceptions surface as FastAPI's plain 500. */
const internalError = () => new Response('Internal Server Error', { status: 500, headers: { 'Content-Type': 'text/plain' } })

function cartItemId(value: string | null | undefined): number | Response {
  const n = Number(String(value ?? ''))
  return Number.isInteger(n) && String(value ?? '').trim() !== '' ? n : httpError(400, 'cartItemID 无效')
}

function mutateCart(req: CartMutationRequest): Response {
  try {
    switch (req.action) {
      case 'add':
        if (!req.productID) return httpError(400, 'productID 不能为空')
        cartStore.addProduct(req.productID, req.skuID, req.quantity || 1)
        break
      case 'remove': {
        const id = cartItemId(req.cartItemID)
        if (id instanceof Response) return id
        if (!cartStore.removeItem(id)) return httpError(404, '购物车商品不存在')
        break
      }
      case 'updateQuantity': {
        if (req.quantity == null) return httpError(400, 'quantity 不能为空')
        const id = cartItemId(req.cartItemID)
        if (id instanceof Response) return id
        cartStore.setQuantity(id, req.quantity)
        break
      }
      case 'updateSpecification': {
        if (!req.productID || !req.skuID) return httpError(400, 'productID 和 skuID 不能为空')
        const id = cartItemId(req.cartItemID)
        if (id instanceof Response) return id
        const current = cartStore.listItems().find((l) => l.cart_item_id === id)
        if (!current) return httpError(404, '购物车商品不存在')
        const quantity = req.quantity || current.quantity
        cartStore.removeItem(id)
        cartStore.addProduct(req.productID, req.skuID, quantity)
        break
      }
      default:
        return httpError(400, '不支持的购物车操作')
    }
  } catch (err) {
    if (err instanceof CartNotFoundError) return internalError()
    throw err
  }
  return json(cartStore.snapshot())
}

function sseResponse(req: ChatRequest, signal?: AbortSignal | null): Response {
  const steps = scriptTurn(req)
  const factor = mockCtl.slow ? 4 : 1
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (const step of steps) {
          await sleep(step.delay * factor, signal)
          const frame = `event: ${step.event.event}\ndata: ${JSON.stringify(step.event.data)}\n\n`
          // Split frames at an arbitrary point so the client's chunk reassembly is exercised.
          const cut = Math.floor(frame.length / 2)
          controller.enqueue(encoder.encode(frame.slice(0, cut)))
          controller.enqueue(encoder.encode(frame.slice(cut)))
        }
        controller.close()
      } catch (err) {
        controller.error(err)
      }
    },
  })
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' },
  })
}

function suggestions() {
  const counts = new Map<string, number>()
  for (const d of catalog) counts.set(d.category, (counts.get(d.category) ?? 0) + 1)
  const categories = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)
  const shuffle = <T,>(xs: T[]) => xs.map((x) => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x)
  const pairs = shuffle([...new Set(catalog.filter((d) => d.brand && d.sub_category).map((d) => `${d.brand.split(/\s+/)[0]}\u0000${d.sub_category}`))])
  const subcats = shuffle([...new Set(catalog.map((d) => d.sub_category).filter((s): s is string => Boolean(s)))])
  const hot = shuffle([...pairs.slice(0, 5).map((p) => p.replace('\u0000', '')), ...subcats.slice(0, 5)])
  return { categories, hot_searches: hot.slice(0, 8) }
}

async function readBody<T>(init?: RequestInit): Promise<T> {
  return JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as T
}

export async function mockFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase()
  const url = new URL(path, 'http://mock.local')
  const p = url.pathname
  const signal = init.signal

  if (mockCtl.offline) {
    await sleep(300, signal)
    throw new TypeError('Failed to fetch')
  }
  await sleep(mockCtl.slow ? 900 : 90, signal)

  let m: RegExpMatchArray | null
  if (method === 'GET' && p === '/health') return json({ status: 'ok' })
  if (method === 'GET' && p === '/warmup') return json({ status: 'disabled', message: 'Startup warmup is disabled.' })

  if (method === 'GET' && (m = p.match(/^\/products\/([^/]+)$/))) {
    const d = getProductDetail(decodeURIComponent(m[1]))
    if (!d) return json({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found', retryable: false, traceID: null }, 404)
    return json(productPayload(d))
  }
  if (method === 'GET' && p === '/products') {
    const ids = (url.searchParams.get('ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
    return json({ requestID: 'products_by_id', products: ids.map(getProductDetail).filter((d): d is ProductDetail => Boolean(d)).map(productPayload) })
  }
  if (method === 'POST' && (m = p.match(/^\/products\/([^/]+)\/pitch$/))) {
    const d = getProductDetail(decodeURIComponent(m[1]))
    if (!d) return json({ code: 'PRODUCT_NOT_FOUND', message: 'Product not found', retryable: false, traceID: null }, 404)
    return json({ description: d.marketing_description.split('。')[0] ?? '' })
  }

  if (method === 'GET' && p === '/cart') return json(cartStore.snapshot())
  if (method === 'POST' && p === '/cart/mutate') return mutateCart(await readBody<CartMutationRequest>(init))
  if (method === 'POST' && p === '/cart/reset') return json({ status: 'cleared', removed: cartStore.clear() })

  if (method === 'POST' && p === '/compare') {
    const req = await readBody<CompareRequest>(init)
    const ids = (req.product_ids ?? []).map((s) => s.trim()).filter(Boolean)
    if (ids.length < 2) return httpError(400, '对比至少需要 2 个商品 id')
    // main.py keeps only the first two ids.
    const details = ids.slice(0, 2).map(getProductDetail).filter((d): d is ProductDetail => Boolean(d))
    if (details.length < 2) return httpError(404, '有效商品不足 2 个，无法对比')
    return json(buildComparison(details))
  }

  if ((m = p.match(/^\/preferences\/([^/]*)(\/undo)?$/))) {
    const userId = decodeURIComponent(m[1]).trim()
    if (!userId) return httpError(400, 'user_id 不能为空')
    if (m[2] && method === 'POST') {
      const { undo_token } = await readBody<{ undo_token: string }>(init)
      const result = preferenceStore.undo(userId, (undo_token ?? '').trim())
      return result ? json(result) : httpError(404, '撤销 token 不存在或已使用')
    }
    if (method === 'GET') return json(preferenceStore.get(userId))
    if (method === 'PUT') return json(preferenceStore.put(preferenceFromDict(userId, await readBody(init))))
  }

  if (method === 'POST' && p === '/title') {
    const req = await readBody<TitleRequest>(init)
    const text = (req.user_text ?? '').trim()
    if (!text) return httpError(400, 'user_text 不能为空')
    // The real endpoint asks the model for 4-8 characters; the mock keeps the first clause.
    const title = text.replace(/^(推荐|帮我找|我想买|找)(一款|一下|几款)?/, '').split(/[，,。！？]/)[0]
    return json({ title: Array.from(title || text).slice(0, 12).join('') })
  }
  if (method === 'GET' && p === '/suggestions') return json(suggestions())

  if (method === 'POST' && p === '/chat/stream') return sseResponse(await readBody<ChatRequest>(init), signal)
  if (method === 'POST' && (m = p.match(/^\/sessions\/([^/]+)\/reset$/))) return json({ status: 'reset', session_id: m[1] })

  return json({ detail: 'Not Found' }, 404)
}
