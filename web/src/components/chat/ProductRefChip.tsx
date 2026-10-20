import type { ReactNode } from 'react'
import { useProduct } from '../../hooks/useProducts'
import type { ProductRef } from '../../lib/productRef'
import { ProductImage } from '../product/ProductImage'

/** Thumbnail + title of a product referenced via 引用商品, in the composer and in sent messages. */
export function ProductRefChip({ productRef, children }: { productRef: ProductRef; children?: ReactNode }) {
  const { data: product } = useProduct(productRef.id)
  return (
    <span className="flex min-w-0 items-center gap-2.5 rounded-xl border border-line-strong bg-surface py-1.5 pl-1.5 pr-3 text-ink">
      <ProductImage src={product?.imageURL} alt="" fit="cover" className="h-9 w-9 shrink-0 rounded-lg border border-line" />
      <span className="flex min-w-0 flex-col">
        <span className="text-[11px] leading-4 text-ink-subtle">引用商品</span>
        <span className="truncate text-[13px] font-medium leading-[18px]">{productRef.title}</span>
      </span>
      {children}
    </span>
  )
}
