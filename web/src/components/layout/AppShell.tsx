import { useRef, useState } from 'react'
import { Navigate, Outlet, useSearchParams } from 'react-router-dom'
import { useIsNarrow } from '../../hooks/useIsNarrow'
import { usePresence } from '../../hooks/usePresence'
import { SettingsDialog } from '../../pages/settings/SettingsLayout'
import { ProductPanel } from '../product/ProductPanel'
import { Toaster } from '../Toaster'
import { MobileDrawer } from './MobileDrawer'
import { OfflineBanner } from './OfflineBanner'
import { Sidebar } from './Sidebar'

/**
 * The desktop detail panel slides in over the right of main (dur-sheet,
 * ease-snap) and only then takes its 420px column, so the cards reflow once
 * instead of on every frame of a width animation. Closing gives main its
 * width back first, under the panel, then slides the panel out.
 */
function ProductColumn({ productId, onClose }: { productId: string | null; onClose: () => void }) {
  const last = useRef(productId)
  if (productId) last.current = productId
  const shown = productId ?? last.current
  const open = Boolean(productId)
  const presence = usePresence(open)
  const [docked, setDocked] = useState(open)
  if (!open && docked) setDocked(false)
  if (!presence.mounted || !shown) return null
  return (
    <>
      <div aria-hidden="true" className={`shrink-0 ${docked ? 'w-[420px]' : 'w-0'}`} />
      <div
        data-state={presence.state}
        onAnimationEnd={(e) => (open ? e.target === e.currentTarget && setDocked(true) : presence.onAnimationEnd(e))}
        className={`absolute inset-y-0 right-0 z-20 flex ${docked ? '' : 'animate-panel-in closing:animate-panel-out'}`}
      >
        <ProductPanel key={shown} productId={shown} onClose={onClose} />
      </div>
    </>
  )
}

/**
 * Desktop: three columns, history sidebar · main · product detail (?product=).
 * Phone (< 768 px): one column, the drawer replaces the sidebar and product
 * detail is its own page at /p/:productId. 100dvh keeps the bottom bars above
 * Safari's collapsing address bar.
 */
export function AppShell() {
  const narrow = useIsNarrow()
  const [params, setParams] = useSearchParams()
  const productId = params.get('product')
  const closeProduct = () => {
    const next = new URLSearchParams(params)
    next.delete('product')
    setParams(next, { replace: true })
  }

  if (narrow) {
    if (productId) return <Navigate to={`/p/${productId}`} replace />
    return (
      <div className="flex h-[100dvh] min-h-0 flex-col bg-bg text-ink">
        <main className="relative flex min-h-0 grow flex-col">
          <Outlet />
          <div className="pointer-events-none absolute inset-x-0 top-[calc(56px+env(safe-area-inset-top))] z-30 [&>*]:pointer-events-auto">
            <OfflineBanner />
          </div>
          <Toaster />
        </main>
        <MobileDrawer />
        <SettingsDialog />
      </div>
    )
  }

  return (
    <div className="relative flex h-[100dvh] min-h-0 bg-bg text-ink">
      <Sidebar />
      <main className="relative flex min-w-0 grow flex-col">
        <OfflineBanner />
        <Outlet />
        <Toaster />
      </main>
      <ProductColumn productId={productId} onClose={closeProduct} />
      <SettingsDialog />
    </div>
  )
}
