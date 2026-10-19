import { useState } from 'react'
import { useProduct } from '../../hooks/useProducts'
import type { SpecSelection } from '../../stores/conversations'
import { ProductImage } from '../product/ProductImage'

/**
 * WebInChat ⑰ 规格选择卡, from a cart tool `ask_spec` result. Submitting sends
 * "我要 <values>" as the next user turn, as SpecSelectionCard does on iOS; the
 * cart tool's pending_add resolves it into an add.
 */
export function SpecSelectionCard({ spec, disabled, onSubmit }: { spec: SpecSelection; disabled: boolean; onSubmit: (chosen: Record<string, string>, phrase: string) => void }) {
  const [selected, setSelected] = useState<Record<string, string>>(spec.chosen ?? {})
  const { data: product } = useProduct(spec.product_id)
  const submitted = Boolean(spec.chosen)
  const allChosen = spec.dimensions.every((d) => selected[d.name])
  const label = submitted ? '已选择' : allChosen ? '加入购物车' : '请选择规格'

  return (
    <section aria-label="选择规格" className="flex w-full max-w-[380px] flex-col gap-3 rounded-[18px] border border-line bg-surface p-3.5 shadow-[0_2px_6px_rgba(43,30,18,0.04)]">
      <div className="flex items-center gap-2.5">
        <ProductImage src={product?.imageURL ?? null} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-line" />
        <span className="line-clamp-2 text-[13px] font-semibold">{spec.title}</span>
      </div>
      {spec.dimensions.map((d) => (
        <div key={d.name} className="flex flex-col gap-2">
          <div className="text-sm font-semibold">{d.name}</div>
          <div role="radiogroup" aria-label={d.name} className="flex flex-wrap gap-2">
            {d.values.map((v) => {
              const on = selected[d.name] === v
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={submitted}
                  onClick={() => setSelected((s) => ({ ...s, [d.name]: v }))}
                  className={`rounded-full px-3.5 py-2 text-sm font-medium ${on ? 'bg-primary text-on-primary' : 'bg-soft-purple text-primary-text'}`}
                >
                  {v}
                </button>
              )
            })}
          </div>
        </div>
      ))}
      <button
        type="button"
        disabled={!allChosen || submitted || disabled}
        onClick={() => onSubmit(selected, `我要 ${spec.dimensions.map((d) => selected[d.name]).join(' ')}`)}
        className={`h-10 rounded-xl text-sm font-semibold text-on-primary ${allChosen && !submitted && !disabled ? 'bg-primary' : 'bg-[rgba(206,135,99,0.4)]'}`}
      >
        {label}
      </button>
    </section>
  )
}
