import { useParams } from 'react-router-dom'
import type { Product } from '../api/types'
import { IconShare } from '../components/Icons'
import { BackButton, MobileHeader, MobileTitle } from '../components/layout/MobileHeader'
import { Basis, QuantityStepper, SpecPicker, useAddToCart } from '../components/product/ProductPanel'
import { ProductImage } from '../components/product/ProductImage'
import { Reviews } from '../components/product/Reviews'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useProduct } from '../hooks/useProducts'

function share(product: Product) {
  const data = { title: product.title, url: window.location.href }
  if (navigator.share) void navigator.share(data).catch(() => undefined)
  else void navigator.clipboard?.writeText(data.url)
}

function Body({ product }: { product: Product }) {
  const cart = useAddToCart(product)
  const price = cart.sku?.price.display ?? product.price.display
  // Prices of the other SKUs, e.g. "40ml ¥190", straight from the payload.
  const others = product.specifications.length === 1 ? product.skus.filter((s) => s.id !== cart.sku?.id).slice(0, 2) : []
  return (
    <>
      <div className="flex min-h-0 grow flex-col gap-3.5 overflow-y-auto px-4 pb-6 pt-3.5">
        <ProductImage src={product.imageURL} alt={product.title} className="h-[236px] w-full shrink-0 rounded-[18px] border border-line" />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-2">
            <span className="text-[28px] font-bold leading-[1.1] text-error-text" aria-live="polite">
              {price}
            </span>
            {others.length > 0 && (
              <span className="text-xs text-ink-subtle">{others.map((s) => `${Object.values(s.selectedOptions)[0]?.split(' ')[0]} ${s.price.display}`).join(' · ')}</span>
            )}
          </div>
          <div className="text-lg font-bold leading-[25px]">{product.title}</div>
        </div>
        <SpecPicker product={product} selection={cart.selection} onChoose={cart.choose} />
        <Basis product={product} />
        <Reviews reviews={product.reviews} />
      </div>
      <div className="flex shrink-0 items-center gap-2.5 border-t border-line bg-surface px-4 pb-[max(10px,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-6px_16px_rgba(43,30,18,0.05)]">
        <QuantityStepper value={cart.quantity} onChange={cart.setQuantity} />
        <button
          type="button"
          onClick={() => void cart.add()}
          disabled={!cart.sku || cart.adding}
          className="flex h-11 grow items-center justify-center gap-2 rounded-xl bg-primary text-base font-semibold text-on-primary disabled:opacity-60"
        >
          {cart.sku ? `加入购物车 · ${cart.sku.price.display}` : '该规格暂无货'}
        </button>
      </div>
    </>
  )
}

/** ⑭ MWebDetail: standalone product page on phones, spec chosen in page, fixed add-to-cart bar. */
export function ProductPage() {
  const { productId = '' } = useParams()
  const { data: product, isPending, isError, refetch } = useProduct(productId)
  useDocumentTitle(product?.title ?? '商品详情')
  return (
    <>
      <MobileHeader
        left={<BackButton label="返回对话" />}
        right={
          product && (
            <button type="button" aria-label="分享商品" onClick={() => share(product)} className="flex h-11 w-11 items-center justify-center p-0 text-ink">
              <IconShare size={18} />
            </button>
          )
        }
      >
        <MobileTitle>商品详情</MobileTitle>
      </MobileHeader>
      {product ? (
        <Body key={product.productID} product={product} />
      ) : (
        <div className="flex grow flex-col items-center justify-center gap-3 text-sm text-ink-muted">
          {isPending ? '正在加载商品详情…' : isError ? '商品详情加载失败' : null}
          {isError && (
            <button type="button" onClick={() => void refetch()} className="rounded-full bg-primary px-4 py-1.5 text-[13px] font-semibold text-on-primary">
              重试
            </button>
          )}
        </div>
      )}
    </>
  )
}
