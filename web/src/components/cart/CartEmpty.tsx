import { Link } from 'react-router-dom'
import { IconCart } from '../Icons'

/** WebStates ⑦ 购物车为空. */
export function CartEmpty({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2.5 text-center ${compact ? 'p-6' : 'grow p-5'}`}>
      <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-full bg-soft-purple text-primary-text">
        <IconCart size={30} strokeWidth={1.8} />
      </span>
      <span className="text-[17px] font-semibold">购物车为空</span>
      <span className="text-[13px] leading-[19px] text-ink-muted">从导购推荐里加入商品后会显示在这里。</span>
      <Link to="/" className="mt-1.5 rounded-full bg-primary px-[18px] py-[9px] text-sm font-semibold text-on-primary no-underline hover:text-on-primary">
        去问问 AI
      </Link>
    </div>
  )
}
