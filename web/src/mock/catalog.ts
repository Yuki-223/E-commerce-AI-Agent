/**
 * Mock product catalog built from the repository's real data/<category>/data/*.json,
 * shaped exactly like backend/api/products.py product_payload(). Imported only in
 * mock mode (dynamic import from api/http.ts), so production builds skip it.
 */
import type { Evidence, Money, Product, Review, Sku, Specification } from '../api/types'
import compareIndexJson from '../../../backend/storage/compare_index.json'

interface RawProduct {
  product_id: string
  title: string
  brand: string
  category: string
  sub_category?: string | null
  base_price: number
  image_path?: string | null
  skus: { sku_id: string; properties: Record<string, string>; price: number }[]
  rag_knowledge?: {
    marketing_description?: string
    official_faq?: { question: string; answer: string }[]
    user_reviews?: { nickname: string; rating: number; content: string }[]
  }
}

/** Mirror of store/product_store.py ProductDetail. */
export interface ProductDetail {
  product_id: string
  title: string
  brand: string
  category: string
  sub_category: string | null
  base_price: number
  image_url: string | null
  price_range: { min_price: number; max_price: number; sku_count: number }
  skus: { sku_id: string; properties: Record<string, string>; price: number; stock_qty: number }[]
  marketing_description: string
  faqs: { source_index: number; question: string; answer: string }[]
  reviews: { source_index: number; nickname: string; rating: number; content: string; polarity: Review['polarity'] }[]
}

const rawModules = import.meta.glob<RawProduct>('../../../data/*/data/*.json', { eager: true, import: 'default' })

// The CDN in backend/cdn/image_manifest.json is not reachable from every dev
// machine, so mock mode serves the same photos from data/*/images via Vite.
const imageModules = import.meta.glob<string>('../../../data/*/images/*', {
  eager: true,
  query: '?url',
  import: 'default',
})
const imageByFile = new Map<string, string>()
for (const [path, url] of Object.entries(imageModules)) {
  imageByFile.set(path.split('/').slice(-3).join('/'), url)
}

function reviewPolarity(rating: number): Review['polarity'] {
  if (rating >= 4) return 'positive'
  if (rating <= 2) return 'negative'
  return 'neutral'
}

function toDetail(p: RawProduct): ProductDetail {
  // import_product_data.py seeds every SKU with stock_qty 999; get_skus orders by price, sku_id.
  const skus = p.skus
    .map((s) => ({ sku_id: s.sku_id, properties: s.properties ?? {}, price: Number(s.price), stock_qty: 999 }))
    .sort((a, b) => a.price - b.price || cmp(a.sku_id, b.sku_id))
  const prices = skus.map((s) => s.price)
  const rag = p.rag_knowledge ?? {}
  return {
    product_id: p.product_id,
    title: p.title,
    brand: p.brand,
    category: p.category,
    sub_category: p.sub_category ?? null,
    base_price: Number(p.base_price),
    image_url: p.image_path ? imageByFile.get(p.image_path) ?? null : null,
    price_range: {
      min_price: prices.length ? Math.min(...prices) : Number(p.base_price),
      max_price: prices.length ? Math.max(...prices) : Number(p.base_price),
      sku_count: skus.length,
    },
    skus,
    marketing_description: rag.marketing_description ?? '',
    faqs: (rag.official_faq ?? []).map((f, i) => ({ source_index: i, question: f.question ?? '', answer: f.answer ?? '' })),
    reviews: (rag.user_reviews ?? []).map((r, i) => {
      const rating = Math.trunc(Number(r.rating ?? 3))
      return { source_index: i, nickname: r.nickname ?? '', rating, content: r.content ?? '', polarity: reviewPolarity(rating) }
    }),
  }
}

/** Python str ordering (code point) for ASCII/BMP strings. */
export function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export const catalog: ProductDetail[] = Object.values(rawModules)
  .map(toDetail)
  .sort((a, b) => cmp(a.product_id, b.product_id))

const byId = new Map(catalog.map((d) => [d.product_id, d]))

export function getProductDetail(id: string): ProductDetail | undefined {
  return byId.get(id)
}

/** Python f"{x:g}" for the price magnitudes in this catalog. */
export function fmtG(n: number): string {
  return String(Number(n.toPrecision(6)))
}

/** store/product_store.py price_display. */
export function priceDisplay(r: ProductDetail['price_range']): string {
  if (r.min_price === r.max_price) return `¥${fmtG(r.min_price)}`
  return `¥${fmtG(r.min_price)} 起`
}

function money(amount: number, display?: string): Money {
  return { currency: 'CNY', amountMinor: Math.round(amount * 100), display: display || `¥${fmtG(amount)}` }
}

function specifications(skus: ProductDetail['skus']): Specification[] {
  const sets = new Map<string, Set<string>>()
  for (const sku of skus) {
    for (const [name, value] of Object.entries(sku.properties)) {
      if (!sets.has(name)) sets.set(name, new Set())
      sets.get(name)!.add(String(value))
    }
  }
  return [...sets.entries()]
    .sort(([a], [b]) => cmp(a, b))
    .map(([name, options]) => ({
      id: name,
      name,
      options: [...options].sort(cmp).map((option) => ({ id: `${name}_${option}`, label: option, isAvailable: true })),
    }))
}

function availability(skus: ProductDetail['skus']): Product['availability'] {
  if (!skus.length) return 'unknown'
  if (skus.some((s) => s.stock_qty > 10)) return 'inStock'
  if (skus.some((s) => s.stock_qty > 0)) return 'lowStock'
  return 'outOfStock'
}

function evidence(d: ProductDetail): Evidence[] {
  const out: Evidence[] = []
  if (d.marketing_description) {
    out.push({ id: `${d.product_id}_marketing`, sourceType: 'productDetail', title: d.title, snippet: d.marketing_description, score: 1, updatedAt: null })
  }
  for (const faq of d.faqs.slice(0, 2)) {
    out.push({ id: `${d.product_id}_faq_${faq.source_index}`, sourceType: 'productDetail', title: faq.question, snippet: faq.answer, score: null, updatedAt: null })
  }
  for (const r of d.reviews) {
    out.push({ id: `${d.product_id}_review_${r.source_index}`, sourceType: 'userReview', title: `${r.nickname} · ${r.rating} 星`, snippet: r.content, score: null, updatedAt: null })
  }
  return out
}

/** backend/api/products.py product_payload. */
export function productPayload(d: ProductDetail): Product {
  return {
    productID: d.product_id,
    title: d.title,
    category: d.category,
    brand: d.brand,
    imageURL: d.image_url,
    detailURL: null,
    price: money(d.price_range.min_price, priceDisplay(d.price_range)),
    originalPrice: null,
    availability: availability(d.skus),
    summary: d.marketing_description || null,
    tags: [d.category, d.sub_category, d.brand].filter((v): v is string => Boolean(v)),
    specifications: specifications(d.skus),
    skus: d.skus.map(
      (s): Sku => ({
        id: s.sku_id,
        selectedOptions: Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [String(k), String(v)])),
        price: money(s.price),
        availability: s.stock_qty > 0 ? 'inStock' : 'outOfStock',
        stockCount: s.stock_qty,
      }),
    ),
    reviews: d.reviews.map((r) => ({ id: `review_${r.source_index}`, nickname: r.nickname, rating: r.rating, content: r.content, polarity: r.polarity })),
    evidence: evidence(d),
    updatedAt: null,
  }
}

// ---------------------------------------------------------------------------
// Comparison: agent/comparison.py build_comparison (lookups only, no LLM)
// ---------------------------------------------------------------------------

type CompareIndex = Record<string, { dims?: Record<string, string>; tagline?: string }>
const compareIndex = compareIndexJson as CompareIndex

const CATEGORY_DIMENSIONS: Record<string, string[]> = {
  数码电子: ['性能/芯片', '续航', '屏幕', '存储规格'],
  美妆护肤: ['核心功效', '关键成分', '适用肤质', '容量规格'],
  服饰运动: ['材质面料', '版型', '适用场景', '尺码颜色'],
  食品生活: ['口味风味', '配料成分', '规格分量', '适用场景'],
}
const GENERIC_DIMENSIONS = ['品牌定位', '核心卖点', '适用场景']

export function buildComparison(details: ProductDetail[]) {
  const categories = new Set(details.map((d) => d.category))
  const dims = categories.size === 1 ? CATEGORY_DIMENSIONS[details[0].category] ?? GENERIC_DIMENSIONS : GENERIC_DIMENSIONS
  let minIdx = 0
  details.forEach((d, i) => {
    if (d.price_range.min_price < details[minIdx].price_range.min_price) minIdx = i
  })
  const rows = [
    { label: '价格', values: details.map((d) => priceDisplay(d.price_range)), highlight: minIdx as number | null },
    ...dims.map((dim) => ({
      label: dim,
      values: details.map((d) => String(compareIndex[d.product_id]?.dims?.[dim] ?? '').trim() || '—'),
      highlight: null,
    })),
  ]
  return {
    title: `对比：${details.map((d) => Array.from(d.title).slice(0, 16).join('')).join(' vs ')}`,
    products: details.map((d) => ({
      product_id: d.product_id,
      title: d.title,
      brand: d.brand,
      price: d.price_range.min_price,
      image_url: d.image_url,
    })),
    rows,
    recommendation: '',
  }
}

export function compareDim(id: string, dim: string): string {
  return String(compareIndex[id]?.dims?.[dim] ?? '').trim()
}

/** For phase two: the tagline the real /compare does not return yet. */
export function compareTagline(id: string): string {
  return String(compareIndex[id]?.tagline ?? '').trim()
}
