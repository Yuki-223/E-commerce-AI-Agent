import { Link } from 'react-router-dom'
import { useCart } from '../hooks/useCart'
import { IconCart } from './Icons'

export function CartButton({ onClick, expanded }: { onClick?: () => void; expanded?: boolean }) {
  const { data } = useCart()
  const count = data?.cart.item_count ?? 0
  const className =
    'relative flex h-9 w-9 items-center justify-center rounded-full border border-line-strong bg-surface text-primary-text hover:bg-field'
  const badge =
    count > 0 ? (
      <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-error-text px-1 text-[11px] font-bold text-white">
        {count > 99 ? '99+' : count}
      </span>
    ) : null
  const label = `购物车，${count} 件`
  if (onClick) {
    return (
      <button type="button" aria-label={label} aria-haspopup="dialog" aria-expanded={expanded} onClick={onClick} className={className}>
        <IconCart />
        {badge}
      </button>
    )
  }
  return (
    <Link to="/cart" aria-label={label} className={className}>
      <IconCart />
      {badge}
    </Link>
  )
}
