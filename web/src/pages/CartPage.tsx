import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/http'
import type { CartLine, Product } from '../api/types'
import { IconChevronDown, IconChevronUp, IconTrash } from '../components/Icons'
import { CartEmpty } from '../components/cart/CartEmpty'
import { CollapseBox } from '../components/Collapse'
import { SpecDialog } from '../components/cart/SpecDialog'
import { ProductImage } from '../components/product/ProductImage'
import { useCart, useCartMutation } from '../hooks/useCart'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useIsNarrow } from '../hooks/useIsNarrow'
import { usePresence, usePresenceList } from '../hooks/usePresence'
import { BackButton, MenuButton, MobileHeader, MobileTitle } from '../components/layout/MobileHeader'
import { shortSummary, useProducts } from '../hooks/useProducts'
import { optionsText, yuan, yuan2 } from '../lib/format'
import { round2 } from '../lib/money'
import { useCartSelection } from '../stores/cartSelection'
import { useConversations } from '../stores/conversations'
import { toast } from '../stores/toast'

/*
 * The list card is a size container. At 740px+ each row is a table row
 * (商品 · 单价 · 数量 · 小计 · 删除); narrower, the numbers drop to a second
 * line under the title so the product column never collapses.
 */
const COLS = 'grid gap-3 [@container(min-width:740px)]:grid-cols-[minmax(0,1fr)_72px_116px_88px_36px] [@container(min-width:740px)]:items-center'

function QuantityInput({ line, onCommit, disabled }: { line: CartLine; onCommit: (q: number) => void; disabled: boolean }) {
  const [draft, setDraft] = useState(String(line.quantity))
  useEffect(() => setDraft(String(line.quantity)), [line.quantity])
  const commit = () => {
    const n = Math.floor(Number(draft))
    if (!Number.isFinite(n) || n < 1) return setDraft(String(line.quantity))
    if (n !== line.quantity) onCommit(Math.min(n, 999))
  }
  return (
    <div className="flex h-9 w-[116px] items-center rounded-[10px] bg-secondary">
      <button type="button" aria-label="减少" disabled={disabled || line.quantity <= 1} onClick={() => onCommit(line.quantity - 1)} className="h-9 w-9 p-0 text-[17px] text-ink-muted disabled:opacity-40">
        −
      </button>
      <label className="grow">
        <span className="sr-only-label">数量</span>
        <input
          inputMode="numeric"
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          className="w-full bg-transparent text-center text-[15px] font-semibold outline-none"
        />
      </label>
      <button type="button" aria-label="增加" disabled={disabled} onClick={() => onCommit(line.quantity + 1)} className="h-9 w-9 p-0 text-[17px] text-primary-text disabled:opacity-40">
        +
      </button>
    </div>
  )
}

function CartRow({ line, product, selected, onSelect, last }: { line: CartLine; product?: Product; selected: boolean; onSelect: (on: boolean) => void; last: boolean }) {
  const mutation = useCartMutation()
  // Dimmed from the 删除 click until the row has collapsed away; restored if the request fails.
  const removing = mutation.variables?.action === 'remove' && !mutation.isError
  const [specOpen, setSpecOpen] = useState(false)
  const spec = usePresence(specOpen && !!product)
  const run = async (req: Parameters<typeof mutation.mutateAsync>[0]) => {
    try {
      await mutation.mutateAsync(req)
    } catch (err) {
      toast({ tone: 'error', title: '购物车更新失败', detail: err instanceof ApiError ? err.message : '请稍后再试' })
    }
  }
  const specName = product?.specifications.map((s) => s.name).join(' / ') || '规格'
  const id = String(line.cart_item_id)
  return (
    <div
      className={`relative grid grid-cols-[18px_88px_minmax(0,1fr)] items-start gap-x-3.5 px-5 py-[18px] transition-opacity duration-snap [@container(min-width:740px)]:items-center ${last ? '' : 'border-b border-line-faint'} ${removing ? 'opacity-50' : ''}`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => onSelect(e.target.checked)}
        aria-label={`选择 ${line.title}`}
        className="m-0 mt-[35px] h-[18px] w-[18px] accent-[var(--primary)] [@container(min-width:740px)]:mt-0"
      />
      <Link to={`?product=${line.product_id}`} className="block h-[88px] w-[88px] overflow-hidden rounded-[14px] border border-line">
        <ProductImage src={product?.imageURL} alt={line.title} className="h-full w-full" fit="cover" />
      </Link>
      <div className={`min-w-0 ${COLS}`}>
        <div className="relative flex min-w-0 flex-col gap-1.5">
          <Link to={`?product=${line.product_id}`} className="line-clamp-2 text-[15px] font-semibold leading-[21px] text-ink no-underline hover:text-ink">
            {line.title}
          </Link>
          {product && <span className="truncate text-xs text-ink-subtle">{shortSummary(product)}</span>}
          {Object.keys(line.options).length > 0 && (
            <div className="relative min-w-0 max-w-full self-start">
              <button
                type="button"
                aria-expanded={specOpen}
                disabled={!product || product.skus.length < 2}
                onClick={() => setSpecOpen((o) => !o)}
                className={`flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-[5px] text-xs ${
                  specOpen ? 'border-[1.5px] border-primary bg-primary-soft font-semibold text-primary-text' : 'border border-line-strong bg-field text-ink-muted'
                }`}
              >
                <span className="truncate">
                  {specName}：{optionsText(line.options)}
                </span>
                {product && product.skus.length > 1 && (specOpen ? <IconChevronUp /> : <IconChevronDown />)}
              </button>
              {spec.mounted && product && (
                <SpecDialog
                  presence={spec.props}
                  line={line}
                  product={product}
                  busy={mutation.isPending}
                  onCancel={() => setSpecOpen(false)}
                  onConfirm={async (skuId) => {
                    await run({ action: 'updateSpecification', cartItemID: id, productID: line.product_id, skuID: skuId, quantity: line.quantity })
                    setSpecOpen(false)
                  }}
                />
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-4 [@container(min-width:740px)]:contents">
          <span className="min-w-[76px] text-sm [@container(min-width:740px)]:min-w-0">
            {yuan(line.unit_price)}
            <span className="text-ink-subtle [@container(min-width:740px)]:hidden"> / 件</span>
          </span>
          <QuantityInput line={line} disabled={mutation.isPending} onCommit={(q) => void run({ action: 'updateQuantity', cartItemID: id, quantity: q })} />
          <span className="ml-auto text-[15px] font-bold text-error-text [@container(min-width:740px)]:ml-0">{yuan2(line.subtotal)}</span>
          <button
            type="button"
            aria-label={`删除 ${line.title}`}
            onClick={() => void run({ action: 'remove', cartItemID: id })}
            className="-ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] p-0 text-ink-subtle hover:bg-field [@container(min-width:740px)]:ml-0"
          >
            <IconTrash />
          </button>
        </div>
      </div>
    </div>
  )
}

/** ㊑ MWebCart row: card with checkbox, photo, spec chip and stepper. */
function MobileCartRow({ line, product, selected, onSelect }: { line: CartLine; product?: Product; selected: boolean; onSelect: (on: boolean) => void }) {
  const mutation = useCartMutation()
  // Dimmed from the 删除 click until the row has collapsed away; restored if the request fails.
  const removing = mutation.variables?.action === 'remove' && !mutation.isError
  const [specOpen, setSpecOpen] = useState(false)
  const spec = usePresence(specOpen && !!product)
  const run = async (req: Parameters<typeof mutation.mutateAsync>[0]) => {
    try {
      await mutation.mutateAsync(req)
    } catch (err) {
      toast({ tone: 'error', title: '购物车更新失败', detail: err instanceof ApiError ? err.message : '请稍后再试' })
    }
  }
  const id = String(line.cart_item_id)
  const specName = product?.specifications.map((s) => s.name).join(' / ') || '规格'
  return (
    <article className={`relative flex gap-2.5 rounded-[18px] border border-line bg-surface p-3 shadow-card transition-opacity duration-snap ${removing ? 'opacity-50' : ''}`}>
      <label className="flex w-7 shrink-0 cursor-pointer items-center justify-center">
        <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} aria-label={`选择 ${line.title}`} className="m-0 h-5 w-5 accent-[var(--primary)]" />
      </label>
      <Link to={`/p/${line.product_id}`} className="block h-[76px] w-[76px] shrink-0 overflow-hidden rounded-[14px] border border-line">
        <ProductImage src={product?.imageURL} alt={line.title} className="h-full w-full" fit="cover" />
      </Link>
      <div className="flex min-w-0 grow flex-col gap-1.5">
        <div className="flex gap-1">
          <span className="line-clamp-2 grow text-sm font-semibold leading-[19px]">{line.title}</span>
          <button type="button" aria-label={`删除 ${line.title}`} onClick={() => void run({ action: 'remove', cartItemID: id })} className="flex h-8 w-8 shrink-0 items-center justify-center p-0 text-ink-subtle">
            <IconTrash size={15} />
          </button>
        </div>
        {Object.keys(line.options).length > 0 && (
          <div className="relative self-start">
            <button
              type="button"
              aria-expanded={specOpen}
              disabled={!product || product.skus.length < 2}
              onClick={() => setSpecOpen((o) => !o)}
              className="flex items-center gap-1 rounded-full bg-soft-purple px-[9px] py-1 text-xs text-ink-muted"
            >
              {specName}：{optionsText(line.options)}
              {product && product.skus.length > 1 && <IconChevronDown />}
            </button>
            {spec.mounted && product && (
              <SpecDialog
                presence={spec.props}
                line={line}
                product={product}
                busy={mutation.isPending}
                onCancel={() => setSpecOpen(false)}
                onConfirm={async (skuId) => {
                  await run({ action: 'updateSpecification', cartItemID: id, productID: line.product_id, skuID: skuId, quantity: line.quantity })
                  setSpecOpen(false)
                }}
              />
            )}
          </div>
        )}
        <div className="flex items-center">
          <span className="grow text-base font-bold text-error-text">{yuan(line.unit_price)}</span>
          <div className="flex h-9 items-center rounded-[10px] bg-secondary">
            <button type="button" aria-label="减少" disabled={mutation.isPending || line.quantity <= 1} onClick={() => void run({ action: 'updateQuantity', cartItemID: id, quantity: line.quantity - 1 })} className="h-9 w-9 p-0 text-[17px] text-ink-muted disabled:opacity-40">
              −
            </button>
            <span className="w-7 text-center text-[15px] font-semibold">{line.quantity}</span>
            <button type="button" aria-label="增加" disabled={mutation.isPending} onClick={() => void run({ action: 'updateQuantity', cartItemID: id, quantity: line.quantity + 1 })} className="h-9 w-9 p-0 text-[17px] text-primary-text">
              +
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

/** ⑱ WebCart: full cart page. Every amount shown is a value from GET /cart. */
export function CartPage() {
  const { data, isPending, isError, refetch } = useCart()
  const lines = useMemo(() => data?.cart.lines ?? [], [data])
  const { data: products } = useProducts(useMemo(() => [...new Set(lines.map((l) => l.product_id))], [lines]), { keepPrevious: true })
  // A removed line stays in place while it collapses, so the rows below slide up instead of jumping.
  const rows = usePresenceList(lines, (l) => String(l.cart_item_id))
  const byId = new Map(products?.map((p) => [p.productID, p]))
  const { unselected, toggle, setAll } = useCartSelection()
  const lastConv = useConversations((s) => Object.values(s.conversations).sort((a, b) => b.updatedAt - a.updatedAt)[0])

  const itemCount = data?.cart.item_count ?? 0
  useDocumentTitle(`购物车（${itemCount}）`)

  const selected = lines.filter((l) => !unselected.includes(l.cart_item_id))
  const allSelected = lines.length > 0 && selected.length === lines.length
  const selectedQty = selected.reduce((n, l) => n + l.quantity, 0)
  // With everything ticked this is exactly cart.total; otherwise the sum of the ticked lines' subtotals.
  const selectedTotal = allSelected ? data!.cart.total : round2(selected.reduce((n, l) => n + l.subtotal, 0))
  const narrow = useIsNarrow()

  if (narrow) {
    return (
      <>
        <MobileHeader left={<BackButton label="返回对话" />} right={<MenuButton />}>
          <MobileTitle>购物车（{itemCount}）</MobileTitle>
        </MobileHeader>
        {isPending ? (
          <div className="p-6 text-sm text-ink-muted">正在加载购物车…</div>
        ) : lines.length === 0 ? (
          <CartEmpty />
        ) : (
          <>
            <div className="flex min-h-0 grow flex-col overflow-y-auto px-4 pb-4 pt-3.5">
              {rows.map(({ key, item: l, props }) => (
                <CollapseBox key={key} presence={props} appear={false}>
                  <div className="pb-3">
                    <MobileCartRow line={l} product={byId.get(l.product_id)} selected={!unselected.includes(l.cart_item_id)} onSelect={(on) => toggle(l.cart_item_id, on)} />
                  </div>
                </CollapseBox>
              ))}
              <p className="mx-1 mt-1 text-xs leading-[18px] text-ink-subtle">点规格可以改；在对话里说“把第二个删掉”也能修改购物车。</p>
            </div>
            <div className="flex shrink-0 items-center gap-3 border-t border-line bg-surface px-4 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-6px_16px_rgba(43,30,18,0.05)]">
              <label className="flex min-h-11 cursor-pointer items-center gap-1.5 text-sm">
                <input type="checkbox" checked={allSelected} onChange={(e) => setAll(lines.map((l) => l.cart_item_id), e.target.checked)} className="m-0 h-5 w-5 accent-[var(--primary)]" />
                全选
              </label>
              <div className="flex grow flex-col gap-px">
                <span className="text-xs text-ink-subtle">已选 {selectedQty} 件</span>
                <span className="text-lg font-bold text-error-text" data-testid="cart-total">{yuan2(selectedTotal)}</span>
              </div>
              <button type="button" disabled={selectedQty === 0} title="演示版暂不支持下单" className="h-11 rounded-full bg-primary px-5 active:scale-[0.97] text-[15px] font-semibold text-on-primary disabled:opacity-50">
                结算（{selectedQty}）
              </button>
            </div>
          </>
        )}
      </>
    )
  }

  return (
    <div className="flex min-h-0 grow flex-col gap-5 overflow-y-auto px-10 py-7">
      <div className="flex items-baseline gap-3">
        <h1 className="m-0 text-[26px] font-bold">购物车（{itemCount}）</h1>
        <Link to={lastConv ? `/c/${lastConv.id}` : '/'} className="text-[13px] text-ink-muted no-underline">
          ← 回到对话继续挑
        </Link>
      </div>

      {isPending ? (
        <div className="text-sm text-ink-muted">正在加载购物车…</div>
      ) : isError ? (
        <div className="flex items-center gap-3 text-sm text-ink-muted">
          购物车加载失败
          <button type="button" onClick={() => void refetch()} className="rounded-full bg-primary px-3.5 py-1.5 text-[13px] font-semibold text-on-primary">
            重试
          </button>
        </div>
      ) : lines.length === 0 ? (
        <CartEmpty />
      ) : (
        <div className="flex items-start gap-6">
          <section aria-label="商品清单" className="min-w-0 grow rounded-[20px] [container-type:inline-size] border border-line bg-surface shadow-[0_2px_6px_rgba(43,30,18,0.04)]">
            <div className="grid grid-cols-[18px_minmax(0,1fr)] items-center gap-x-3.5 border-b border-line px-5 py-3.5 text-[13px] text-ink-muted">
              <input type="checkbox" checked={allSelected} onChange={(e) => setAll(lines.map((l) => l.cart_item_id), e.target.checked)} aria-label="全选" className="m-0 h-[18px] w-[18px] accent-[var(--primary)]" />
              <div className={COLS}>
                <span>商品（全选）</span>
                <span className="hidden [@container(min-width:740px)]:block">单价</span>
                <span className="hidden [@container(min-width:740px)]:block">数量</span>
                <span className="hidden [@container(min-width:740px)]:block">小计</span>
              </div>
            </div>
            {rows.map(({ key, item: l, props }) => (
              <CollapseBox key={key} presence={props} appear={false}>
                <CartRow
                  line={l}
                  product={byId.get(l.product_id)}
                  selected={!unselected.includes(l.cart_item_id)}
                  onSelect={(on) => toggle(l.cart_item_id, on)}
                  last={l.cart_item_id === lines[lines.length - 1].cart_item_id}
                />
              </CollapseBox>
            ))}
          </section>

          <aside aria-label="结算" className="sticky top-0 flex w-80 shrink-0 flex-col gap-4 rounded-[20px] border border-line bg-surface p-5 shadow-[0_2px_6px_rgba(43,30,18,0.04)]">
            <div className="flex flex-col gap-1">
              <span className="text-[13px] text-ink-muted">
                {lines.length} 款 · 共 {itemCount} 件{selectedQty !== itemCount && `，已选 ${selectedQty} 件`} · 合计
              </span>
              <span className="text-[30px] font-bold leading-tight text-error-text" data-testid="cart-total">
                {yuan2(selectedTotal)}
              </span>
            </div>
            {/* Checkout is a no-op, matching the iOS app (handoff doc: 不做真实下单). */}
            <button type="button" disabled={selectedQty === 0} title="演示版暂不支持下单" className="h-10 rounded-[10px] bg-primary text-[15px] font-semibold text-on-primary hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50">
              结算（{selectedQty}）
            </button>
            <p className="m-0 text-xs leading-[18px] text-ink-subtle">
              价格、规格和库存都以商品库为准，不由 AI 生成。在对话里说“把第一个删掉”也能修改购物车。
            </p>
          </aside>
        </div>
      )}
    </div>
  )
}
