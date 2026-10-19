import { Outlet, useSearchParams } from 'react-router-dom'
import { ProductPanel } from '../product/ProductPanel'
import { Toaster } from '../Toaster'
import { OfflineBanner } from './OfflineBanner'
import { Sidebar } from './Sidebar'

/** Desktop three columns: history sidebar · main · product detail (when ?product= is set). */
export function AppShell() {
  const [params, setParams] = useSearchParams()
  const productId = params.get('product')
  const closeProduct = () => {
    const next = new URLSearchParams(params)
    next.delete('product')
    setParams(next, { replace: true })
  }
  return (
    <div className="flex h-full min-h-0 bg-bg text-ink">
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
