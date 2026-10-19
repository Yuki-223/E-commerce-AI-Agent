import { useState } from 'react'
import type { CartLine, Product } from '../../api/types'
import { findSku } from '../../lib/sku'

/** WebCart ⑱ 修改规格 popover. Confirms with an updateSpecification mutation. */
export function SpecDialog({ line, product, onCancel, onConfirm, busy }: {
  line: CartLine
  product: Product
  onCancel: () => void
  onConfirm: (skuId: string) => void
  busy?: boolean
}) {
  const [selection, setSelection] = useState<Record<string, string>>({ ...line.options })
  const sku = findSku(product, selection)
  const choose = (name: string, label: string) => {
    const next = { ...selection, [name]: label }
    const fallback = product.skus.find((s) => s.selectedOptions[name] === label)
    setSelection(findSku(product, next) || !fallback ? next : { ...fallback.selectedOptions })
  }
  return (
    <div role="dialog" aria-label="修改规格" className="absolute left-0 top-full z-30 mt-2 flex w-[300px] flex-col gap-3 rounded-2xl border border-line-strong bg-surface p-4 shadow-pop">
      {product.specifications.map((spec) => (
        <div key={spec.id} className="flex flex-col gap-2">
          <div className="text-sm font-semibold">{spec.name}</div>
          <div role="radiogroup" aria-label={spec.name} className="grid grid-cols-2 gap-2">
            {spec.options.map((o) => {
              const on = selection[spec.name] === o.label
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => choose(spec.name, o.label)}
                  className={`rounded-[10px] px-1.5 py-[9px] text-[13px] font-semibold ${on ? 'border-[1.2px] border-primary bg-primary-tint text-primary-text' : 'border border-line-strong bg-surface text-ink'}`}
                >
                  {o.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {sku && <div className="text-xs text-ink-subtle">单价 {sku.price.display}</div>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="h-[38px] grow rounded-[10px] border border-line-strong bg-surface text-sm text-ink">
          取消
        </button>
        <button
          type="button"
          disabled={!sku || sku.id === line.sku_id || busy}
          onClick={() => sku && onConfirm(sku.id)}
          className="h-[38px] grow rounded-[10px] bg-primary text-sm font-semibold text-on-primary disabled:opacity-50"
        >
          确认修改规格
        </button>
      </div>
    </div>
  )
}
