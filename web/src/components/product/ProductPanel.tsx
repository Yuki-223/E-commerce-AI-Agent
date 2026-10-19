import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/endpoints'
import { IconClose } from '../Icons'

export function useProduct(productId: string) {
  return useQuery({ queryKey: ['product', productId], queryFn: ({ signal }) => api.product(productId, signal), staleTime: 5 * 60_000 })
}

/** Right column on desktop (Web.dc.html). Filled out in step 5. */
export function ProductPanel({ productId, onClose }: { productId: string; onClose: () => void }) {
  const { data, isPending } = useProduct(productId)
  return (
    <aside aria-label="商品详情" className="flex w-[420px] shrink-0 flex-col border-l border-line bg-surface shadow-[-8px_0_24px_rgba(43,30,18,0.04)]">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line-faint pl-5 pr-4">
        <h2 className="m-0 grow text-[15px] font-semibold">商品详情</h2>
        <button type="button" aria-label="关闭详情" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-ink-muted">
          <IconClose />
        </button>
      </div>
      <div className="p-5 text-sm text-ink-muted">{isPending ? '加载中…' : data?.title}</div>
    </aside>
  )
}
