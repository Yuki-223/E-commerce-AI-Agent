import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '../../hooks/useCart'
import { useDrawer } from '../../stores/ui'
import { IconCart, IconChevronLeft, IconMenu } from '../Icons'

const BTN = 'flex h-11 w-11 shrink-0 items-center justify-center p-0'

export function MenuButton() {
  const open = useDrawer((s) => s.set)
  return (
    <button type="button" aria-label="打开菜单" onClick={() => open(true)} className={`${BTN} rounded-full text-ink active:bg-secondary`}>
      <IconMenu />
    </button>
  )
}

export function BackButton({ to, label = '返回' }: { to?: string; label?: string }) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => (to ? navigate(to) : window.history.length > 1 ? navigate(-1) : navigate('/'))}
      className={`${BTN} text-ink`}
    >
      <IconChevronLeft size={20} strokeWidth={2.2} />
    </button>
  )
}

export function MobileCartLink() {
  const { data } = useCart()
  const count = data?.cart.item_count ?? 0
  return (
    <Link to="/cart" aria-label={`购物车，${count} 件`} className={`${BTN} relative text-ink-muted`}>
      <IconCart size={22} strokeWidth={2.1} />
      {count > 0 && (
        <span className="absolute right-[3px] top-[5px] flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold text-bg">{count > 99 ? '99+' : count}</span>
      )}
    </Link>
  )
}

/** Sticky top bar for phone pages; respects the notch with safe-area padding. */
export function MobileHeader({ left, right, children }: { left: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <header className="sticky top-0 z-20 shrink-0 border-b border-line-faint bg-[color-mix(in_srgb,var(--background)_94%,transparent)] pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="flex h-[52px] items-center gap-1 px-2">
        {left}
        <div className="flex min-w-0 grow flex-col items-center">{children}</div>
        {right ?? <span className="w-11 shrink-0" />}
      </div>
    </header>
  )
}

export function MobileTitle({ children }: { children: ReactNode }) {
  return <h1 className="m-0 truncate text-base font-semibold">{children}</h1>
}
