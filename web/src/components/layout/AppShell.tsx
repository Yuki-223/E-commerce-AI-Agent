import { Navigate, Outlet, useSearchParams } from 'react-router-dom'
import { useIsNarrow } from '../../hooks/useIsNarrow'
import { ProductPanel } from '../product/ProductPanel'
import { Toaster } from '../Toaster'
import { MobileDrawer } from './MobileDrawer'
import { OfflineBanner } from './OfflineBanner'
import { Sidebar } from './Sidebar'

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
      </div>
    )
  }

  return (
    <div className="flex h-[100dvh] min-h-0 bg-bg text-ink">
      <Sidebar />
      <main className="relative flex min-w-0 grow flex-col">
        <OfflineBanner />
        <Outlet />
        <Toaster />
      </main>
      {productId && <ProductPanel key={productId} productId={productId} onClose={closeProduct} />}
    </div>
  )
}
