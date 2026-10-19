import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ApiError } from '../api/http'
import type { ComparisonProduct } from '../api/types'
import { CartButton } from '../components/CartButton'
import { IconCheckCircle, IconChevronLeft, IconClose, IconCrown, IconPlusCircle } from '../components/Icons'
import { ProductImage } from '../components/product/ProductImage'
import { useCart, useCartMutation } from '../hooks/useCart'
import { MAX_COMPARE, useComparison } from '../hooks/useComparison'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useProducts } from '../hooks/useProducts'
import { useConversations } from '../stores/conversations'
import { toast } from '../stores/toast'

const CELL_BORDER = 'border-l border-line-faint'

/** Products recommended anywhere in local history, newest first, as candidates to add. */
function useCandidates(exclude: string[], fromConv: string | null) {
  const conversations = useConversations((s) => s.conversations)
  return useMemo(() => {
    const ordered = Object.values(conversations).sort((a, b) => {
      if (a.id === fromConv) return -1
      if (b.id === fromConv) return 1
      return b.updatedAt - a.updatedAt
    })
    const ids: string[] = []
    for (const c of ordered) for (const m of [...c.messages].reverse()) for (const id of m.productIds ?? []) if (!ids.includes(id) && !exclude.includes(id)) ids.push(id)
    return ids.slice(0, 12)
  }, [conversations, exclude, fromConv])
}

function AddSlot({ candidates, onAdd }: { candidates: string[]; onAdd: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const { data: products } = useProducts(open ? candidates : undefined)
  const list = (products ?? []).filter((p) => !q || p.title.includes(q) || p.brand.includes(q))
  return (
    <div className={`relative p-4 ${CELL_BORDER}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-full min-h-[150px] w-full flex-col items-center justify-center gap-1.5 rounded-[14px] border-[1.5px] border-dashed border-[rgba(184,112,77,0.5)] bg-overlay text-sm font-semibold text-primary-text"
      >
        <IconPlusCircle />
        添加商品对比
        <span className="text-xs font-normal text-ink-subtle">从对话推荐或搜索中选择</span>
      </button>
      {open && (
        <div role="dialog" aria-label="选择要对比的商品" className="absolute left-4 right-4 top-[calc(100%-8px)] z-30 flex max-h-[360px] flex-col gap-2 rounded-2xl border border-line-strong bg-surface p-3 shadow-pop">
          <label className="flex items-center gap-2 rounded-[10px] bg-field px-2.5">
            <span className="sr-only-label">搜索商品</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索对话里推荐过的商品" className="h-[34px] grow bg-transparent text-[13px] outline-none" />
          </label>
          <div className="flex flex-col overflow-y-auto">
            {candidates.length === 0 && <p className="m-0 p-2 text-xs text-ink-subtle">对话里还没有其他推荐过的商品。</p>}
            {list.map((p) => (
              <button
                key={p.productID}
                type="button"
                onClick={() => {
                  onAdd(p.productID)
                  setOpen(false)
                }}
                className="flex items-center gap-2.5 rounded-[10px] p-2 text-left hover:bg-field"
              >
                <ProductImage src={p.imageURL} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-line" />
                <span className="line-clamp-2 grow text-xs font-semibold">{p.title}</span>
                <span className="shrink-0 text-xs font-bold text-error-text">{p.price.display}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function HeaderCell({ product, inCart, onRemove, canRemove, detailHref }: { product: ComparisonProduct; inCart: boolean; onRemove: () => void; canRemove: boolean; detailHref: string }) {
  const mutation = useCartMutation()
  return (
    <div className={`relative flex flex-col gap-2 p-4 ${CELL_BORDER}`}>
      {canRemove && (
        <button type="button" aria-label={`移出对比：${product.title}`} onClick={onRemove} className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-surface p-0 text-ink-subtle">
          <IconClose size={10} />
        </button>
      )}
      <Link to={detailHref} aria-label={`查看 ${product.title} 详情`} className="self-start">
        <ProductImage src={product.image_url} alt={product.title} className="h-24 w-24 rounded-xl border border-line" />
      </Link>
      <div className="text-sm font-semibold leading-5">{product.title}</div>
      {/* 适合人群: /compare returns tagline once phase two adds it to _product_header. */}
      {product.tagline && <div className="text-xs text-ink-muted">适合：{product.tagline}</div>}
      {inCart ? (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-success-text">
          <IconCheckCircle size={14} />
          已在购物车
        </div>
      ) : (
        <button
          type="button"
          disabled={mutation.isPending}
          onClick={async () => {
            try {
              await mutation.mutateAsync({ action: 'add', productID: product.product_id, quantity: 1 })
              toast({ title: '已加入购物车', detail: '默认选择最低价规格，可在购物车里修改', action: { label: '去看看', to: '/cart' } })
            } catch (err) {
              toast({ tone: 'error', title: '加入购物车失败', detail: err instanceof ApiError ? err.message : '请稍后再试' })
            }
          }}
          className="self-start rounded-full bg-soft-purple px-3 py-1 text-xs font-semibold text-primary-text"
        >
          加入购物车
        </button>
      )}
    </div>
  )
}

/** ⑪ WebCompare: 2–4 products side by side; price from SQLite, other rows from compare_index. */
export function ComparePage() {
  const [params, setParams] = useSearchParams()
  const ids = useMemo(() => [...new Set((params.get('ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean))].slice(0, MAX_COMPARE), [params])
  const fromConv = params.get('from')
  const conv = useConversations((s) => (fromConv ? s.conversations[fromConv] : undefined))
  const { data, isPending, isError, error, refetch } = useComparison(ids)
  const { data: cart } = useCart()
  const inCart = new Set(cart?.cart.lines.map((l) => l.product_id))
  const candidates = useCandidates(ids, fromConv)
  useDocumentTitle('商品对比')

  const setIds = (next: string[]) => {
    const p = new URLSearchParams(params)
    p.set('ids', next.join(','))
    setParams(p)
  }

  const withProduct = (id: string) => {
    const q = new URLSearchParams(params)
    q.set('product', id)
    return `?${q}`
  }
  const slots = (data?.products.length ?? 0) + (ids.length < MAX_COMPARE ? 1 : 0)
  const cols = `140px repeat(${Math.max(slots, 2)}, minmax(0, 1fr))`

  return (
    <>
      <div className="flex h-14 shrink-0 items-center gap-3.5 border-b border-line-faint px-6">
        <Link to={fromConv ? `/c/${fromConv}` : '/'} className="flex items-center gap-1.5 text-[13px] text-ink-muted no-underline">
          <IconChevronLeft />
          返回对话
        </Link>
        <span aria-hidden="true" className="h-[18px] w-px bg-line-strong" />
        <h1 className="m-0 grow text-base font-semibold">商品对比</h1>
        <CartButton />
      </div>
      <div className="flex min-h-0 grow flex-col gap-3.5 overflow-y-auto px-8 py-6">
        <div className="flex items-baseline gap-2.5">
          <h2 className="m-0 text-[22px] font-bold">{data ? `${data.products.length} 款商品对比` : '商品对比'}</h2>
          <span className="text-[13px] text-ink-subtle">
            最多可对比 {MAX_COMPARE} 款{conv ? ` · 来自“${conv.title}”` : ''}
          </span>
        </div>

        {ids.length < 2 ? (
          <div className="rounded-[18px] border border-line bg-surface p-8 text-center text-sm text-ink-muted">
            至少选择 2 款商品才能对比。在对话的推荐卡片上勾选“加入对比”即可。
          </div>
        ) : isPending ? (
          <div className="rounded-[18px] border border-line bg-surface p-8 text-center text-sm text-ink-muted">正在生成对比…</div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 rounded-[18px] border border-line bg-surface p-8 text-sm text-ink-muted">
            {(error as ApiError)?.message ?? '对比失败'}
            <button type="button" onClick={() => void refetch()} className="rounded-full bg-primary px-4 py-1.5 text-[13px] font-semibold text-white">
              重新尝试
            </button>
          </div>
        ) : (
          <section aria-label="对比表" className="overflow-hidden rounded-[18px] border border-line bg-surface shadow-[0_2px_8px_rgba(43,30,18,0.04)]">
            <div className="grid bg-[rgba(245,239,231,0.65)]" style={{ gridTemplateColumns: cols }}>
              <div />
              {data.products.map((p) => (
                <HeaderCell key={p.product_id} product={p} inCart={inCart.has(p.product_id)} canRemove={ids.length > 2} detailHref={withProduct(p.product_id)} onRemove={() => setIds(ids.filter((x) => x !== p.product_id))} />
              ))}
              {ids.length < MAX_COMPARE && <AddSlot candidates={candidates} onAdd={(id) => setIds([...ids, id])} />}
            </div>
            {data.rows.map((row, i) => (
              <div key={row.label} className="grid text-sm leading-5" style={{ gridTemplateColumns: cols, background: i % 2 === 1 ? 'var(--compare-zebra)' : undefined }}>
                <div className="px-4 py-3.5 text-[13px] font-semibold text-ink-muted">{row.label}</div>
                {row.values.map((v, j) =>
                  row.highlight === j ? (
                    <div key={j} className={`flex items-center gap-1.5 px-4 py-3.5 font-bold text-primary-text ${CELL_BORDER}`}>
                      {v}
                      <span className="flex items-center gap-[3px] rounded-full bg-primary-soft px-[7px] py-0.5 text-[11px] font-semibold">
                        <IconCrown />
                        最低
                      </span>
                    </div>
                  ) : (
                    <div key={j} className={`px-4 py-3.5 ${CELL_BORDER}`}>
                      {v}
                    </div>
                  ),
                )}
                {ids.length < MAX_COMPARE && <div className={CELL_BORDER} />}
              </div>
            ))}
          </section>
        )}
        <p className="m-0 text-xs text-ink-subtle">价格实时读取商品库（SQLite），其余维度来自离线整理的对比索引，不由大模型临时生成。</p>
      </div>
    </>
  )
}
