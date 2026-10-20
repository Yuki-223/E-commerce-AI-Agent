import { Link, useNavigate } from 'react-router-dom'
import type { CartResponse } from '../api/types'
import type { PresenceProps } from '../hooks/usePresence'
import { useProducts } from '../hooks/useProducts'
import { optionsText, yuan, yuan2 } from '../lib/format'
import { CartEmpty } from './cart/CartEmpty'
import { ProductImage } from './product/ProductImage'

/** WebCompare ⑪ 购物车下拉面板, anchored under the header cart button. */
export function CartDropdown({ data, onClose, presence }: { data: CartResponse | undefined; onClose: () => void; presence?: PresenceProps }) {
  const navigate = useNavigate()
  const lines = data?.cart.lines ?? []
  const { data: products } = useProducts([...new Set(lines.map((l) => l.product_id))], { keepPrevious: true })
  const byId = new Map(products?.map((p) => [p.productID, p]))
  return (
    <section
      {...presence}
      aria-label="购物车"
      role="dialog"
      className="absolute right-[-16px] top-[50px] z-40 flex origin-top-right animate-pop-up closing:animate-pop-up-out w-[380px] flex-col rounded-[18px] border border-line-strong bg-surface shadow-[0_18px_48px_rgba(43,30,18,0.16),0_2px_6px_rgba(43,30,18,0.06)]"
    >
      <div aria-hidden="true" className="absolute -top-[7px] right-[28px] h-3 w-3 rotate-45 border-l border-t border-line-strong bg-surface" />
      <div className="flex items-center px-[18px] pb-2.5 pt-4">
        <h2 className="m-0 grow text-[15px] font-semibold">购物车（{data?.cart.item_count ?? 0}）</h2>
        <Link to="/cart" onClick={onClose} className="text-xs text-primary-text no-underline">
          查看完整购物车
        </Link>
      </div>
      {lines.length === 0 ? (
        <CartEmpty compact />
      ) : (
        <>
          <div className="max-h-[360px] overflow-y-auto">
            {lines.map((l) => (
              <div key={l.cart_item_id} className="flex items-center gap-3 px-[18px] py-2.5">
                <ProductImage src={byId.get(l.product_id)?.imageURL ?? null} alt={l.title} fit="cover" className="h-14 w-14 shrink-0 rounded-xl border border-line" />
                <div className="flex min-w-0 grow flex-col gap-[3px]">
                  <div className="truncate text-[13px] font-semibold">{l.title}</div>
                  {Object.keys(l.options).length > 0 && (
                    <div className="truncate text-xs text-ink-subtle">
                      {Object.keys(l.options).join(' / ')}：{optionsText(l.options)}
                    </div>
                  )}
                  <div className="flex items-center">
                    <span className="grow text-sm font-bold text-error-text">{yuan(l.unit_price)}</span>
                    <span className="text-xs text-ink-muted">× {l.quantity}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex items-center gap-3 border-t border-line px-[18px] py-3.5">
            <div className="flex grow flex-col gap-0.5">
              <span className="text-xs text-ink-subtle">已选 {data!.cart.item_count} 件 · 合计</span>
              <span className="text-xl font-bold text-primary-text">{yuan2(data!.cart.total)}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose()
                navigate('/cart')
              }}
              className="h-10 rounded-full bg-primary px-[22px] active:scale-[0.97] text-[15px] font-semibold text-on-primary"
            >
              去结算（{data!.cart.item_count}）
            </button>
          </div>
        </>
      )}
    </section>
  )
}
