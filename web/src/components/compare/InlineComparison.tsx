import { Link } from 'react-router-dom'
import type { Comparison } from '../../api/types'
import { ProductImage } from '../product/ProductImage'

/** WebInChat ⑰ 对话内对比表: compact table under the answer, linking to the full page. */
export function InlineComparison({ comparison, convId }: { comparison: Comparison; convId: string }) {
  const cols = `90px repeat(${comparison.products.length}, minmax(0, 1fr))`
  const ids = comparison.products.map((p) => p.product_id).join(',')
  return (
    <section aria-label="对话内对比表" className="w-full max-w-[600px] overflow-hidden rounded-2xl border border-line bg-surface text-[13px] leading-[18px] shadow-[0_2px_6px_rgba(43,30,18,0.04)]">
      <div className="grid bg-[var(--compare-head)]" style={{ gridTemplateColumns: cols }}>
        <div />
        {comparison.products.map((p) => (
          <div key={p.product_id} className="flex items-center gap-2 p-2.5">
            <ProductImage src={p.image_url} alt={p.title} className="h-10 w-10 shrink-0 rounded-lg" />
            <span className="line-clamp-2 text-xs font-semibold leading-4">{p.title}</span>
          </div>
        ))}
      </div>
      {comparison.rows.map((row, i) => (
        <div key={row.label} className={`grid ${i % 2 === 1 ? 'bg-field' : ''}`} style={{ gridTemplateColumns: cols }}>
          <div className="px-2.5 py-[9px] font-semibold text-ink-muted">{row.label}</div>
          {row.values.map((v, j) => (
            <div key={j} className={`px-2.5 py-[9px] ${row.highlight === j ? 'font-bold text-primary-text' : ''}`}>
              {v}
              {row.highlight === j && ' · 最低'}
            </div>
          ))}
        </div>
      ))}
      <Link
        to={`/compare?ids=${ids}&from=${convId}`}
        className="block border-t border-line-faint p-2.5 text-center text-[13px] font-semibold text-primary-text no-underline"
      >
        打开完整对比页 →
      </Link>
    </section>
  )
}
