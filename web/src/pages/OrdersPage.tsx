import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../api/http'
import { api } from '../api/endpoints'
import type { OrderRecord, OrderStatus } from '../api/types'
import { PageFrame, Pills } from '../components/layout/PageFrame'
import { OrderCard } from '../components/orders/OrderCard'
import { ORDERS_KEY, useOrders } from '../hooks/useCommerce'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useProducts } from '../hooks/useProducts'
import { useAuth } from '../stores/auth'
import { toast } from '../stores/toast'
import { BUTTON, BUTTON_DANGER, BUTTON_PRIMARY, FIELD } from './settings/ui'

type Tab = 'all' | OrderStatus

const TABS: { value: Tab; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pending_payment', label: '待支付' },
  { value: 'paid', label: '待发货' },
  { value: 'shipped', label: '已发货' },
  { value: 'completed', label: '已完成' },
  { value: 'refund_requested', label: '退款中' },
  { value: 'cancelled', label: '已取消' },
]

function ShopperActions({ order }: { order: OrderRecord }) {
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [refunding, setRefunding] = useState(false)
  const [reason, setReason] = useState('')

  const run = async (label: string, call: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await call()
      await qc.invalidateQueries({ queryKey: ORDERS_KEY })
      toast({ tone: 'success', title: label })
      setRefunding(false)
    } catch (err) {
      toast({ tone: 'error', title: `${label}失败`, detail: err instanceof ApiError ? err.message : '请稍后再试' })
    } finally {
      setBusy(false)
    }
  }

  if (refunding) {
    return (
      <form className="flex w-full flex-wrap gap-2" onSubmit={(e) => (e.preventDefault(), void run('已提交退款申请', () => api.requestRefund(order.order_id, reason)))}>
        <input className={`${FIELD} min-w-0 grow`} placeholder="退款原因（选填）" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} aria-label="退款原因" />
        <button type="button" className={BUTTON} onClick={() => setRefunding(false)}>
          取消
        </button>
        <button type="submit" disabled={busy} className={BUTTON_DANGER}>
          提交退款
        </button>
      </form>
    )
  }

  return (
    <>
      {order.status === 'pending_payment' && (
        <>
          <button type="button" disabled={busy} className={BUTTON} onClick={() => void run('订单已取消', () => api.orderAction(order.order_id, 'cancel'))}>
            取消订单
          </button>
          {/* Payment is simulated: the backend just records the transition. */}
          <button type="button" disabled={busy} className={BUTTON_PRIMARY} onClick={() => void run('支付成功', () => api.orderAction(order.order_id, 'pay'))}>
            立即支付
          </button>
        </>
      )}
      {(order.status === 'paid' || order.status === 'shipped') && (
        <button type="button" disabled={busy} className={BUTTON} onClick={() => setRefunding(true)}>
          申请退款
        </button>
      )}
      {order.status === 'shipped' && (
        <button type="button" disabled={busy} className={BUTTON_PRIMARY} onClick={() => void run('已确认收货', () => api.orderAction(order.order_id, 'confirm'))}>
          确认收货
        </button>
      )}
    </>
  )
}

/** 我的订单: persisted orders with pay / cancel / confirm / refund. */
export function OrdersPage() {
  const [tab, setTab] = useState<Tab>('all')
  const account = useAuth((s) => s.account)
  const { data, isPending, isError, refetch } = useOrders(tab === 'all' ? null : tab)
  const orders = useMemo(() => data?.orders ?? [], [data])
  const ids = useMemo(() => [...new Set(orders.flatMap((o) => o.items.map((i) => i.product_id)))], [orders])
  const { data: products } = useProducts(ids, { keepPrevious: true })
  const byId = useMemo(() => new Map(products?.map((p) => [p.productID, p])), [products])
  useDocumentTitle('我的订单')

  return (
    <PageFrame
      title="我的订单"
      aside={
        !account && (
          <span className="text-[13px] text-ink-muted">
            当前是共享体验账号，<Link to="/login?next=/orders">登录</Link>后订单只属于你。
          </span>
        )
      }
    >
      <Pills<Tab> label="订单状态" value={tab} options={TABS} onChange={setTab} />
      {isPending ? (
        <p className="text-sm text-ink-muted">正在加载订单…</p>
      ) : isError ? (
        <div className="flex items-center gap-3 text-sm text-ink-muted">
          订单加载失败
          <button type="button" onClick={() => void refetch()} className={BUTTON_PRIMARY}>
            重试
          </button>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-ink-muted">
          <span className="text-[17px] font-semibold text-ink">{tab === 'all' ? '还没有订单' : '这个状态下没有订单'}</span>
          <Link to="/">去问问 AI 挑点什么</Link>
        </div>
      ) : (
        <div className="flex max-w-[860px] flex-col gap-4">
          {orders.map((o) => (
            <OrderCard key={o.order_id} order={o} products={byId} actions={<ShopperActions order={o} />} />
          ))}
        </div>
      )}
    </PageFrame>
  )
}
