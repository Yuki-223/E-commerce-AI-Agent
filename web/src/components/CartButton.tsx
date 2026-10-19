import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useCart } from '../hooks/useCart'
import { CartDropdown } from './CartDropdown'
import { IconCart } from './Icons'

/** Header cart button with count badge; opens the cart dropdown (WebCompare ⑪). */
export function CartButton() {
  const { data } = useCart()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const count = data?.cart.item_count ?? 0

  useEffect(() => setOpen(false), [location.pathname])
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        aria-label={`购物车，${count} 件`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`relative flex h-9 w-9 items-center justify-center rounded-full p-0 text-primary-text ${
          open ? 'border-[1.5px] border-primary bg-primary-soft' : 'border border-line-strong bg-surface hover:bg-field'
        }`}
      >
        <IconCart />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-error-text px-1 text-[11px] font-bold text-on-primary">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      {open && <CartDropdown data={data} onClose={() => setOpen(false)} />}
    </div>
  )
}
