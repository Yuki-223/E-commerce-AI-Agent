import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useCart } from '../hooks/useCart'
import { useBump } from '../hooks/useBump'
import { usePresence } from '../hooks/usePresence'
import { CartDropdown } from './CartDropdown'
import { IconCart } from './Icons'

/** Borderless header cart icon with count badge, as in claude.ai; opens the cart dropdown (WebCompare ⑪). */
export function CartButton() {
  const { data } = useCart()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const count = data?.cart.item_count ?? 0
  const dropdown = usePresence(open)
  const bump = useBump(count)

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
        className={`relative flex h-9 w-9 items-center justify-center rounded-lg p-0 hover:bg-sidebar-active hover:text-ink ${
          open ? 'bg-sidebar-active text-ink' : 'text-ink-muted'
        }`}
      >
        <IconCart size={20} strokeWidth={2} />
        {count > 0 && (
          <span key={bump.key} className={`absolute right-px top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold text-bg ${bump.className}`}>
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>
      {dropdown.mounted && <CartDropdown data={data} presence={dropdown.props} onClose={() => setOpen(false)} />}
    </div>
  )
}
