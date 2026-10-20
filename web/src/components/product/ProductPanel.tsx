import { useEffect, useMemo, useRef, useState } from 'react'
import type { Product } from '../../api/types'
import { useCartMutation } from '../../hooks/useCart'
import { usePreference } from '../../hooks/usePreference'
import { useProduct } from '../../hooks/useProducts'
import { ApiError } from '../../api/http'
import { defaultSelection, findSku, optionPrice } from '../../lib/sku'
import { suggestOptions } from '../../lib/skuMatch'
import { useActiveProfile } from '../../stores/profiles'
import { useRecordView } from '../../stores/recentProducts'
import { toast } from '../../stores/toast'
import { IconBulb, IconCartAdd, IconClose } from '../Icons'
import { ProductImage } from './ProductImage'
import { Reviews } from './Reviews'
import { SafetyFacts } from './SafetyFacts'

/** Spec choice + quantity + POST /cart/mutate add, shared by the side panel and the phone page. */
export function useAddToCart(product: Product | undefined) {
  const [selection, setSelection] = useState<Record<string, string>>(() => (product ? defaultSelection(product) : {}))
  const [quantity, setQuantity] = useState(1)
  const mutation = useCartMutation()
  const sku = product ? findSku(product, selection) : undefined
  const { data: pref } = usePreference(useActiveProfile().userId)
  const touched = useRef(false)

  // Preselect the profile's size or shade once preferences arrive, unless the shopper already chose.
  useEffect(() => {
    if (!product || touched.current) return
    const dims = Object.fromEntries(product.specifications.map((s) => [s.name, s.options.map((o) => o.label)]))
    const suggested = suggestOptions(dims, pref)
    if (!Object.keys(suggested).length) return
    const next = { ...defaultSelection(product), ...suggested }
    const exact = findSku(product, next)
    if (exact) setSelection({ ...exact.selectedOptions })
  }, [product, pref])

  const choose = (name: string, option: string) => {
    if (!product) return
    touched.current = true
    const next = { ...selection, [name]: option }
    // Jump to a real SKU when the combination does not exist.
    const exact = findSku(product, next)
    const fallback = product.skus.find((s) => s.selectedOptions[name] === option)
    setSelection(exact ? next : fallback ? { ...fallback.selectedOptions } : next)
  }

  const add = async () => {
    if (!product || !sku) return
    try {
      await mutation.mutateAsync({ action: 'add', productID: product.productID, skuID: sku.id, quantity })
      const spec = Object.values(sku.selectedOptions).join(' / ')
      toast({ title: '已加入购物车', detail: `数量 ${quantity}${spec ? ` · 规格：${spec}` : ''}`, action: { label: '去看看', to: '/cart' } })
    } catch (err) {
      toast({ tone: 'error', title: '加入购物车失败', detail: err instanceof ApiError ? err.message : '请稍后再试' })
    }
  }

  return { selection, choose, sku, quantity, setQuantity, add, adding: mutation.isPending }
}

export function SpecPicker({ product, selection, onChoose }: { product: Product; selection: Record<string, string>; onChoose: (name: string, option: string) => void }) {
  if (!product.specifications.length) return null
  return (
    <>
      {product.specifications.map((spec) => (
        <div key={spec.id} className="flex flex-col gap-2">
          <div className="text-[13px] font-semibold">{spec.name}</div>
          <div role="radiogroup" aria-label={spec.name} className="grid grid-cols-2 gap-2">
            {spec.options.map((o) => {
              const checked = selection[spec.name] === o.label
              const price = optionPrice(product, spec.name, o.label)
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => onChoose(spec.name, o.label)}
                  className={`rounded-[10px] px-2 py-[9px] text-[13px] font-semibold ${
                    checked ? 'border-[1.2px] border-primary bg-primary-tint text-primary-text' : 'border border-line-strong bg-surface text-ink'
                  }`}
                >
                  {o.label}
                  {price && ` · ${price}`}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}

export function QuantityStepper({ value, onChange, max = 99 }: { value: number; onChange: (n: number) => void; max?: number }) {
  return (
    <div className="flex h-10 items-center rounded-[10px] bg-secondary">
      <button type="button" aria-label="减少" disabled={value <= 1} onClick={() => onChange(value - 1)} className="h-10 w-9 p-0 text-lg text-ink-subtle disabled:opacity-45">
        −
      </button>
      <span aria-live="polite" className="w-8 text-center text-[15px] font-semibold">
        {value}
      </span>
      <button type="button" aria-label="增加" disabled={value >= max} onClick={() => onChange(value + 1)} className="h-10 w-9 p-0 text-lg text-primary-text disabled:opacity-45">
        +
      </button>
    </div>
  )
}

export function Basis({ product }: { product: Product }) {
  const text = useMemo(() => {
    const s = product.summary ?? product.evidence.find((e) => e.sourceType === 'productDetail')?.snippet ?? ''
    const two = s.split(/(?<=[。！？])/).slice(0, 2).join('')
    return two.length > 110 ? `${two.slice(0, 108)}…` : two
  }, [product])
  if (!text) return null
  return (
    <div className="flex flex-col gap-1.5 rounded-[14px] bg-secondary p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary-text">
        <IconBulb />
        推荐依据
      </div>
      <p className="m-0 text-[13px] leading-5 text-ink-muted">{text}</p>
    </div>
  )
}

function PanelBody({ product }: { product: Product }) {
  const cart = useAddToCart(product)
  const price = cart.sku?.price.display ?? product.price.display
  return (
    <>
      <div className="flex min-h-0 grow flex-col gap-4 overflow-y-auto px-5 py-[18px]">
        <ProductImage src={product.imageURL} alt={product.title} className="h-[230px] w-full shrink-0 rounded-2xl border border-line" />
        <div className="flex flex-col gap-1.5">
          <div className="text-[28px] font-bold leading-[1.1] text-error-text" aria-live="polite">
            {price}
          </div>
          <div className="text-[17px] font-bold leading-6">{product.title}</div>
        </div>
        <SpecPicker product={product} selection={cart.selection} onChoose={cart.choose} />
        <SafetyFacts product={product} />
        <Basis product={product} />
        <Reviews reviews={product.reviews} />
      </div>
      <div className="flex shrink-0 items-center gap-3 border-t border-line bg-surface px-5 py-3.5">
        <QuantityStepper value={cart.quantity} onChange={cart.setQuantity} />
        <button
          type="button"
          onClick={() => void cart.add()}
          disabled={!cart.sku || cart.adding}
          className="flex h-10 grow items-center justify-center gap-2 rounded-[10px] bg-primary active:scale-[0.98] text-[15px] font-semibold text-on-primary disabled:opacity-60"
        >
          <IconCartAdd />
          {cart.sku ? (cart.adding ? '正在加入…' : '加入购物车') : '该规格暂无货'}
        </button>
      </div>
    </>
  )
}

/** Right column on desktop (Web.dc.html ⑩): pick a spec and add to cart in place. */
export function ProductPanel({ productId, onClose }: { productId: string; onClose: () => void }) {
  const { data: product, isPending, isError, refetch } = useProduct(productId)
  useRecordView(product?.productID)
  return (
    <aside aria-label="商品详情" className="flex w-[420px] shrink-0 flex-col border-l border-line bg-surface shadow-[-8px_0_24px_rgba(43,30,18,0.04)]">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line-faint pl-5 pr-4">
        <h2 className="m-0 grow text-[15px] font-semibold">商品详情</h2>
        <button type="button" aria-label="关闭详情" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary p-0 text-ink-muted">
          <IconClose />
        </button>
      </div>
      {product ? (
        <PanelBody key={product.productID} product={product} />
      ) : (
        <div className="flex grow flex-col items-center justify-center gap-3 p-6 text-sm text-ink-muted">
          {isPending ? (
            '正在加载商品详情…'
          ) : isError ? (
            <>
              商品详情加载失败
              <button type="button" onClick={() => void refetch()} className="rounded-full bg-primary px-4 py-1.5 text-[13px] font-semibold text-on-primary">
                重试
              </button>
            </>
          ) : null}
        </div>
      )}
    </aside>
  )
}
