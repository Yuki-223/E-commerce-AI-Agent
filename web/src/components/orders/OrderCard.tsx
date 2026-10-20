import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { OrderRecord, OrderStatus, Product } from '../../api/types'
import { optionsText, yuan, yuan2 } from '../../lib/format'
import { CARD, sqlTime } from '../layout/PageFrame'
import { ProductImage } from '../product/ProductImage'

const TONE: Record<OrderStatus, string> = {
  pending_payment: 'bg-[color-mix(in_srgb,var(--error)_12%,transparent)] text-error-text',
  paid: 'bg-primary-soft text-primary-text',
  shipped: 'bg-primary-soft text-primary-text',
  completed: 'bg-secondary text-ink-muted',
  cancelled: 'bg-secondary text-ink-subtle',
  refund_requested: 'bg-[color-mix(in_srgb,var(--error)_12%,transparent)] text-error-text',
  refunded: 'bg-secondary text-ink-subtle',
}

export function StatusBadge({ order }: { order: OrderRecord }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[order.status]}`}>{order.status_label}</span>
}

/**
 * One persisted order (store/order_store.py): shop and status on top, the
 * snapshot lines, then the total and whatever `actions` the viewer may take.
 */
export function OrderCard({ order, products, actions, children, showBuyer = false }: { order: OrderRecord; products?: Map<string, Product>; actions?: ReactNode; children?: ReactNode; showBuyer?: boolean }) {
  return (
    <article className={`${CARD} flex flex-col`} aria-label={`订单 ${order.order_id}`}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-faint px-5 py-3 text-[13px]">
        <span className="font-semibold">{order.merchant_name}</span>
        <span className="text-ink-subtle">{sqlTime(order.created_at)}</span>
        <span className="font-mono text-[11px] text-ink-subtle">{order.order_id}</span>
        {showBuyer && <span className="text-ink-subtle">买家 {order.user_id}</span>}
        <span className="ml-auto">
          <StatusBadge order={order} />
        </span>
      </header>
      <ul className="m-0 flex list-none flex-col gap-3 px-5 py-4">
        {order.items.map((item) => (
          <li key={item.sku_id} className="flex items-center gap-3">
            <Link to={`?product=${item.product_id}`} className="block h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-line">
              <ProductImage src={products?.get(item.product_id)?.imageURL} alt={item.title} className="h-full w-full" fit="cover" />
            </Link>
            <div className="flex min-w-0 grow flex-col gap-0.5">
              <span className="line-clamp-1 text-sm font-medium">{item.title}</span>
              {Object.keys(item.options).length > 0 && <span className="truncate text-xs text-ink-subtle">{optionsText(item.options)}</span>}
            </div>
            <span className="shrink-0 text-right text-[13px] text-ink-muted">
              {yuan(item.unit_price)} × {item.quantity}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-1 border-t border-line-faint px-5 py-3 text-[13px] text-ink-muted">
        <span className="truncate">收货：{order.address}</span>
        {order.tracking_no && (
          <span>
            物流：{order.carrier} · {order.tracking_no}
          </span>
        )}
        {order.refund_reason && ['refund_requested', 'refunded'].includes(order.status) && <span>退款原因：{order.refund_reason}</span>}
      </div>
      {children}
      <footer className="flex flex-wrap items-center gap-2 border-t border-line-faint px-5 py-3">
        <span className="grow text-sm">
          共 {order.item_count} 件 · 实付 <b className="text-base text-error-text">{yuan2(order.total)}</b>
        </span>
        {actions}
      </footer>
    </article>
  )
}
