import type { Product } from '../../api/types'
import { shortSummary } from '../../hooks/useProducts'
import { ProductImage } from '../product/ProductImage'

interface Props {
  product: Product
  description?: string
  viewing: boolean
  compareChecked: boolean
  onToggleCompare: (checked: boolean) => void
  onOpen: () => void
}

/** Recommendation card in the chat (Web.dc.html ⑩). Price and tags come from GET /products. */
export function ProductCard({ product, description, viewing, compareChecked, onToggleCompare, onOpen }: Props) {
  const tags = product.tags.slice(1, 3)
  return (
    <article
      className={`flex flex-col gap-2.5 rounded-[18px] bg-surface p-3 ${
        viewing ? 'border-2 border-primary shadow-[0_4px_14px_rgba(206,135,99,0.14)]' : 'border border-line shadow-card'
      }`}
    >
      <div className="flex gap-3">
        <button type="button" onClick={onOpen} className="shrink-0 rounded-xl p-0" aria-label={`查看 ${product.title} 详情`}>
          <ProductImage src={product.imageURL} alt={product.title} className="h-28 w-28 rounded-xl border border-line" />
        </button>
        <div className="flex min-w-0 flex-col gap-1.5">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span key={t} className="rounded-full bg-soft-purple px-[9px] py-[3px] text-xs font-medium text-primary-text">
                  {t}
                </span>
              ))}
            </div>
          )}
          <div className="line-clamp-3 text-sm font-semibold leading-5">{product.title}</div>
          <div className="text-lg font-bold text-error-text">{product.price.display}</div>
        </div>
      </div>
      <p className="m-0 text-[13px] leading-[19px] text-ink-muted">{description || shortSummary(product)}</p>
      <div className="mt-auto flex gap-2">
        <button
          type="button"
          onClick={onOpen}
          className={`h-9 grow rounded-[10px] text-[13px] font-semibold ${viewing ? 'bg-soft-purple text-primary-text' : 'bg-primary text-white'}`}
        >
          {viewing ? '正在查看详情' : '查看详情'}
        </button>
        <label className="flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-line-strong px-3 text-[13px]">
          <input type="checkbox" checked={compareChecked} onChange={(e) => onToggleCompare(e.target.checked)} className="m-0 accent-[var(--primary)]" />
          加入对比
        </label>
      </div>
    </article>
  )
}
