import { useState } from 'react'
import { useProduct } from '../../hooks/useProducts'
import { optionsText, yuan, yuan2 } from '../../lib/format'
import { round2 } from '../../lib/money'
import type { OrderChoice, SpecSelection } from '../../stores/conversations'
import { IconCheck } from '../Icons'
import { ProductImage } from '../product/ProductImage'
import { QuantityStepper } from '../product/ProductPanel'

interface Props {
  spec: SpecSelection
  disabled: boolean
  /** 加入购物车: answers the cart tool's spec question as the next user turn. */
  onAddToCart: (choice: OrderChoice, phrase: string) => void
  /** 直接下单: POST /orders, after which the card shows the receipt. */
  onOrder: (choice: OrderChoice) => Promise<void>
}

/**
 * The order card for a cart tool `ask_spec` result: spec and quantity come
 * prefilled from the conversation, then 加入购物车 or 直接下单. Once ordered the
 * same card turns into the receipt instead of a new message appearing.
 */
export function SpecSelectionCard({ spec, disabled, onAddToCart, onOrder }: Props) {
  const [selected, setSelected] = useState<Record<string, string>>(spec.chosen ?? {})
  const [quantity, setQuantity] = useState(spec.chosenQuantity ?? spec.quantity ?? 1)
  const [ordering, setOrdering] = useState(false)
  const { data: product } = useProduct(spec.product_id)

  if (spec.order) return <Receipt spec={spec} image={product?.imageURL ?? null} />

  // Prefer the candidate SKUs the backend asked about; fall back to the product's own.
  const candidates =
    spec.skus?.map((s) => ({ id: s.sku_id, options: s.options, price: s.price, stock: s.stock_qty ?? undefined })) ??
    product?.skus.map((s) => ({ id: s.id, options: s.selectedOptions, price: s.price.amountMinor / 100, stock: s.stockCount })) ??
    []
  const allChosen = spec.dimensions.every((d) => selected[d.name])
  const sku = allChosen ? candidates.find((c) => spec.dimensions.every((d) => c.options[d.name] === selected[d.name])) : undefined
  const prices = candidates.map((c) => c.price)
  const from = prices.length ? Math.min(...prices) : null
  const submitted = Boolean(spec.chosen)
  const locked = submitted || disabled || ordering
  const choice = (): OrderChoice => ({ chosen: selected, quantity, skuId: sku?.id ?? null })

  const order = async () => {
    setOrdering(true)
    try {
      await onOrder(choice())
    } finally {
      setOrdering(false)
    }
  }

  return (
    <section aria-label="确认订单" className="flex w-full max-w-[400px] flex-col gap-3.5 rounded-[18px] border border-line bg-surface p-4 shadow-[0_2px_6px_rgba(43,30,18,0.04)]">
      <div className="flex items-center gap-3">
        <ProductImage src={product?.imageURL ?? null} alt="" className="h-12 w-12 shrink-0 rounded-[10px] border border-line" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="line-clamp-2 text-[13px] font-semibold leading-[18px]">{spec.title}</span>
          <span className="text-[13px] font-bold text-error-text">{sku ? yuan(sku.price) : from != null ? `${yuan(from)} 起` : ''}</span>
        </div>
      </div>

      {spec.dimensions.map((d) => (
        <div key={d.name} className="flex flex-col gap-2">
          <div className="text-[13px] font-semibold text-ink-muted">{d.name}</div>
          <div role="radiogroup" aria-label={d.name} className="flex flex-wrap gap-2">
            {d.values.map((v) => {
              const on = selected[d.name] === v
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={locked}
                  onClick={() => setSelected((s) => ({ ...s, [d.name]: v }))}
                  className={`rounded-full px-3.5 py-[7px] text-sm font-medium transition-colors duration-snap ${
                    on ? 'bg-primary text-on-primary' : 'bg-soft-purple text-primary-text hover:bg-secondary'
                  } disabled:cursor-default`}
                >
                  {v}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-[13px] font-semibold text-ink-muted">数量</span>
          {locked ? (
            <span className="text-[15px] font-semibold">× {quantity}</span>
          ) : (
            <QuantityStepper value={quantity} onChange={setQuantity} max={sku?.stock || 99} />
          )}
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[11px] text-ink-subtle">合计</span>
          <span data-testid="order-total" className="text-lg font-bold leading-6 text-error-text">
            {sku ? yuan2(round2(sku.price * quantity)) : '—'}
          </span>
        </div>
      </div>

      {submitted ? (
        <div className="flex items-center gap-1.5 rounded-xl bg-secondary px-3 py-2.5 text-[13px] text-ink-muted">
          <IconCheck size={12} className="text-primary" />
          已按「{optionsText(spec.chosen!)} × {spec.chosenQuantity ?? quantity}」加入购物车
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!sku || locked}
            onClick={() => onAddToCart(choice(), `我要 ${spec.dimensions.map((d) => selected[d.name]).join(' ')}，${quantity} 件`)}
            className="h-10 grow rounded-xl border border-line-strong bg-surface text-sm font-semibold text-ink hover:bg-secondary active:scale-[0.98] disabled:opacity-50"
          >
            加入购物车
          </button>
          <button
            type="button"
            disabled={!sku || locked}
            onClick={() => void order()}
            className="h-10 grow rounded-xl bg-primary text-sm font-semibold text-on-primary hover:bg-primary-hover active:scale-[0.98] disabled:bg-[rgba(206,135,99,0.4)]"
          >
            {ordering ? '正在下单…' : allChosen ? '直接下单' : '请选择规格'}
          </button>
        </div>
      )}
      {!submitted && <p className="m-0 -mt-1 text-[11px] leading-4 text-ink-subtle">价格以商品库为准 · 直接下单寄往默认地址，不经过购物车</p>}
    </section>
  )
}

function Receipt({ spec, image }: { spec: SpecSelection; image: string | null }) {
  const order = spec.order!
  return (
    <section aria-label="订单回执" className="flex w-full max-w-[400px] animate-fade-in flex-col gap-3 rounded-[18px] border border-line bg-surface p-4 shadow-[0_2px_6px_rgba(43,30,18,0.04)]">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-on-primary">
          <IconCheck size={12} />
        </span>
        <span className="text-[15px] font-semibold">已下单</span>
        <span className="ml-auto font-mono text-[11px] text-ink-subtle">{order.order_id}</span>
      </div>
      {order.lines.map((l) => (
        <div key={l.sku_id} className="flex items-center gap-3">
          <ProductImage src={image} alt="" className="h-11 w-11 shrink-0 rounded-[10px] border border-line" />
          <div className="flex min-w-0 grow flex-col gap-0.5">
            <span className="line-clamp-1 text-[13px] font-semibold">{l.title}</span>
            <span className="text-xs text-ink-muted">
              {optionsText(l.options)} · × {l.quantity}
            </span>
          </div>
          <span className="text-[13px] font-semibold">{yuan2(l.subtotal)}</span>
        </div>
      ))}
      <div className="flex flex-col gap-1 border-t border-line-faint pt-3 text-xs text-ink-muted">
        <div className="flex justify-between">
          <span>寄往</span>
          <span className="max-w-[260px] text-right text-ink">{order.address}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span>实付 · 共 {order.item_count} 件</span>
          <span className="text-lg font-bold text-error-text">{yuan2(order.total)}</span>
        </div>
      </div>
    </section>
  )
}
