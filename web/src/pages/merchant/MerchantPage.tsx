import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError } from '../../api/http'
import { api } from '../../api/endpoints'
import type { MerchantProduct, OrderRecord, OrderStatus } from '../../api/types'
import { CARD, PageFrame, Pills } from '../../components/layout/PageFrame'
import { OrderCard } from '../../components/orders/OrderCard'
import { ProductImage } from '../../components/product/ProductImage'
import { MERCHANT_KEY } from '../../hooks/useCommerce'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { yuan, yuan2 } from '../../lib/format'
import { ROLE_LABELS, isSeller, useAuth } from '../../stores/auth'
import { toast } from '../../stores/toast'
import { BUTTON, BUTTON_DANGER, BUTTON_PRIMARY, FIELD, TEXTAREA } from '../settings/ui'
import { ProductEditor } from './ProductEditor'

type Section = 'overview' | 'products' | 'orders' | 'shop'

const errText = (err: unknown) => (err instanceof ApiError ? err.message : '请稍后再试')

// ---------------------------------------------------------------------------
// 概览
// ---------------------------------------------------------------------------

function Tile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className={`${CARD} flex min-w-[150px] grow basis-0 flex-col gap-1 p-4`}>
      <span className="text-[13px] text-ink-muted">{label}</span>
      <span className="text-[26px] font-bold leading-tight">{value}</span>
      {hint && <span className="text-xs text-ink-subtle">{hint}</span>}
    </div>
  )
}

function Overview({ goTo }: { goTo: (s: Section) => void }) {
  const { data, isPending, isError } = useQuery({ queryKey: [...MERCHANT_KEY, 'stats'], queryFn: ({ signal }) => api.merchantStats(signal) })
  if (isPending) return <p className="text-sm text-ink-muted">正在加载经营数据…</p>
  if (isError || !data) return <p className="text-sm text-error-text">经营数据加载失败</p>
  const peak = Math.max(1, ...data.daily_sales.map((d) => d.sales))
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-3">
        <Tile label="累计成交额" value={yuan2(data.revenue)} hint={`${data.paid_order_count} 笔已支付订单`} />
        <Tile label="待发货" value={data.status_counts.paid} hint="买家已付款" />
        <Tile label="退款申请" value={data.status_counts.refund_requested} hint="等待处理" />
        <Tile label="在售商品" value={`${data.active_product_count} / ${data.product_count}`} />
      </div>
      {(data.status_counts.paid > 0 || data.status_counts.refund_requested > 0) && (
        <button type="button" className={`${BUTTON_PRIMARY} self-start`} onClick={() => goTo('orders')}>
          去处理订单
        </button>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${CARD} flex flex-col gap-3 p-5`} aria-label="近 7 天销售">
          <h2 className="m-0 text-[15px] font-semibold">近 7 天销售</h2>
          {data.daily_sales.length === 0 ? (
            <p className="m-0 text-sm text-ink-muted">近 7 天还没有成交。</p>
          ) : (
            data.daily_sales.map((d) => (
              <div key={d.day} className="grid grid-cols-[52px_minmax(0,1fr)_96px] items-center gap-3 text-[13px]">
                <span className="text-ink-muted">{d.day.slice(5)}</span>
                <span className="h-2.5 rounded-full bg-secondary">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${(d.sales / peak) * 100}%` }} />
                </span>
                <span className="text-right">
                  {yuan(d.sales)} · {d.orders} 单
                </span>
              </div>
            ))
          )}
        </section>
        <section className={`${CARD} flex flex-col gap-3 p-5`} aria-label="热销商品">
          <h2 className="m-0 text-[15px] font-semibold">热销商品</h2>
          {data.top_products.length === 0 ? (
            <p className="m-0 text-sm text-ink-muted">还没有销量。</p>
          ) : (
            <ol className="m-0 flex flex-col gap-2 pl-5 text-[13px]">
              {data.top_products.map((p) => (
                <li key={p.product_id}>
                  <span className="font-medium">{p.title}</span>
                  <span className="text-ink-muted">
                    {' '}
                    · 售出 {p.quantity} 件 · {yuan(p.sales)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
      {data.low_stock.length > 0 && (
        <section className={`${CARD} flex flex-col gap-2 p-5`} aria-label="库存预警">
          <h2 className="m-0 text-[15px] font-semibold text-error-text">库存预警（≤ 10 件）</h2>
          {data.low_stock.map((p) => (
            <span key={p.product_id} className="text-[13px]">
              {p.title} · 剩余 {p.total_stock} 件
            </span>
          ))}
        </section>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 商品
// ---------------------------------------------------------------------------

function priceRange(p: MerchantProduct) {
  const prices = p.skus.filter((s) => s.status === 'active').map((s) => s.price)
  if (!prices.length) return '—'
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  return lo === hi ? yuan(lo) : `${yuan(lo)} – ${yuan(hi)}`
}

function Products() {
  const qc = useQueryClient()
  const { data, isPending } = useQuery({ queryKey: [...MERCHANT_KEY, 'products'], queryFn: ({ signal }) => api.merchantProducts(signal) })
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const products = data?.products ?? []
  const current = products.find((p) => p.product_id === editing)

  const toggle = async (p: MerchantProduct) => {
    const next = p.status === 'active' ? 'inactive' : 'active'
    try {
      await api.setProductStatus(p.product_id, next)
      await qc.invalidateQueries({ queryKey: MERCHANT_KEY })
      toast({ tone: 'success', title: next === 'active' ? '已上架' : '已下架', detail: p.title })
    } catch (err) {
      toast({ tone: 'error', title: '操作失败', detail: errText(err) })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {editing === null && (
        <button type="button" className={`${BUTTON_PRIMARY} self-start`} onClick={() => setEditing('new')}>
          + 发布商品
        </button>
      )}
      {editing === 'new' && <ProductEditor onDone={() => setEditing(null)} />}
      {current && <ProductEditor key={current.product_id} product={current} onDone={() => setEditing(null)} />}
      {isPending ? (
        <p className="text-sm text-ink-muted">正在加载商品…</p>
      ) : products.length === 0 ? (
        <p className="text-sm text-ink-muted">店铺里还没有商品，点“发布商品”上架第一件。</p>
      ) : (
        <div className={`${CARD} flex flex-col`}>
          {products.map((p, i) => (
            <div key={p.product_id} className={`flex flex-wrap items-center gap-3 px-5 py-3.5 ${i ? 'border-t border-line-faint' : ''}`}>
              <span className="block h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-line">
                <ProductImage src={p.image_url} alt={p.title} className="h-full w-full" fit="cover" />
              </span>
              <div className="flex min-w-0 grow basis-[220px] flex-col gap-0.5">
                <span className="line-clamp-1 text-sm font-semibold">{p.title}</span>
                <span className="text-xs text-ink-subtle">
                  {p.brand} · {p.category}
                  {p.sub_category ? ` / ${p.sub_category}` : ''} · {p.skus.length} 个 SKU
                </span>
              </div>
              <span className="w-[120px] text-[13px]">{priceRange(p)}</span>
              <span className={`w-[72px] text-[13px] ${p.total_stock <= 10 ? 'text-error-text' : 'text-ink-muted'}`}>库存 {p.total_stock}</span>
              <span className="w-[64px] text-[13px] text-ink-muted">售 {p.sold_qty}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.status === 'active' ? 'bg-primary-soft text-primary-text' : 'bg-secondary text-ink-subtle'}`}>
                {p.status === 'active' ? '在售' : '已下架'}
              </span>
              <button type="button" className={BUTTON} onClick={() => setEditing(p.product_id)}>
                编辑
              </button>
              <button type="button" className={p.status === 'active' ? BUTTON_DANGER : BUTTON} onClick={() => void toggle(p)}>
                {p.status === 'active' ? '下架' : '上架'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 订单
// ---------------------------------------------------------------------------

type OrderTab = 'all' | OrderStatus

const ORDER_TABS: { value: OrderTab; label: string }[] = [
  { value: 'paid', label: '待发货' },
  { value: 'refund_requested', label: '退款申请' },
  { value: 'shipped', label: '已发货' },
  { value: 'pending_payment', label: '待支付' },
  { value: 'completed', label: '已完成' },
  { value: 'all', label: '全部' },
]

const CARRIERS = ['顺丰速运', '中通快递', '圆通速递', '京东物流', 'EMS']

function SellerActions({ order }: { order: OrderRecord }) {
  const qc = useQueryClient()
  const [carrier, setCarrier] = useState(CARRIERS[0])
  const [tracking, setTracking] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (label: string, call: () => Promise<unknown>) => {
    setBusy(true)
    try {
      await call()
      await qc.invalidateQueries({ queryKey: MERCHANT_KEY })
      toast({ tone: 'success', title: label })
    } catch (err) {
      toast({ tone: 'error', title: `${label}失败`, detail: errText(err) })
    } finally {
      setBusy(false)
    }
  }

  if (order.status === 'paid') {
    const ship = (e: FormEvent) => (e.preventDefault(), void run('已发货', () => api.shipOrder(order.order_id, carrier, tracking.trim())))
    return (
      <form onSubmit={ship} className="flex flex-wrap gap-2">
        <select className={FIELD} value={carrier} onChange={(e) => setCarrier(e.target.value)} aria-label="物流公司">
          {CARRIERS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input className={`${FIELD} w-[160px]`} required maxLength={40} placeholder="运单号" value={tracking} onChange={(e) => setTracking(e.target.value)} aria-label="运单号" />
        <button type="submit" disabled={busy} className={BUTTON_PRIMARY}>
          发货
        </button>
      </form>
    )
  }
  if (order.status === 'refund_requested') {
    return (
      <>
        <button type="button" disabled={busy} className={BUTTON} onClick={() => void run('已拒绝退款', () => api.decideRefund(order.order_id, 'reject'))}>
          拒绝
        </button>
        <button type="button" disabled={busy} className={BUTTON_DANGER} onClick={() => void run('已同意退款', () => api.decideRefund(order.order_id, 'approve'))}>
          同意退款
        </button>
      </>
    )
  }
  return null
}

function Orders() {
  const [tab, setTab] = useState<OrderTab>('paid')
  const { data, isPending } = useQuery({
    queryKey: [...MERCHANT_KEY, 'orders', tab],
    queryFn: ({ signal }) => api.merchantOrders(tab === 'all' ? null : tab, signal),
  })
  const orders = data?.orders ?? []
  return (
    <div className="flex flex-col gap-4">
      <Pills<OrderTab> label="订单状态" value={tab} options={ORDER_TABS} onChange={setTab} />
      {isPending ? (
        <p className="text-sm text-ink-muted">正在加载订单…</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-ink-muted">没有这个状态的订单。</p>
      ) : (
        <div className="flex max-w-[860px] flex-col gap-4">
          {orders.map((o) => (
            <OrderCard key={o.order_id} order={o} showBuyer actions={<SellerActions order={o} />} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// 店铺
// ---------------------------------------------------------------------------

function Shop() {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: [...MERCHANT_KEY, 'shop'], queryFn: ({ signal }) => api.shop(signal) })
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  useEffect(() => {
    setName(data?.merchant?.name ?? '')
    setDescription(data?.merchant?.description ?? '')
  }, [data])

  if (data?.admin) return <p className="text-sm text-ink-muted">平台管理员可以管理所有店铺和平台自营商品，没有自己的店铺资料。</p>

  const save = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await api.updateShop({ name: name.trim(), description: description.trim() })
      await qc.invalidateQueries({ queryKey: [...MERCHANT_KEY, 'shop'] })
      toast({ tone: 'success', title: '店铺资料已保存' })
    } catch (err) {
      toast({ tone: 'error', title: '保存失败', detail: errText(err) })
    }
  }

  return (
    <form onSubmit={(e) => void save(e)} className={`${CARD} flex max-w-[560px] flex-col gap-3 p-5`}>
      <label className="flex flex-col gap-1.5 text-[13px] text-ink-muted">
        店铺名称
        <input className={FIELD} required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] text-ink-muted">
        店铺简介
        <textarea className={TEXTAREA} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <button type="submit" className={`${BUTTON_PRIMARY} self-end`}>
        保存
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------------

const SECTIONS: { value: Section; label: string }[] = [
  { value: 'overview', label: '经营概览' },
  { value: 'products', label: '商品管理' },
  { value: 'orders', label: '订单处理' },
  { value: 'shop', label: '店铺设置' },
]

/** 商家后台: dashboard, catalog, order fulfilment and shop profile (/merchant/*). */
export function MerchantPage() {
  const account = useAuth((s) => s.account)
  const [section, setSection] = useState<Section>('overview')
  useDocumentTitle('商家后台')
  const subtitle = useMemo(() => (account ? `${ROLE_LABELS[account.role]} · ${account.nickname}` : ''), [account])

  if (!isSeller(account)) {
    return (
      <PageFrame title="商家后台">
        <div className={`${CARD} flex max-w-[480px] flex-col gap-3 p-6 text-sm`}>
          <p className="m-0">{account ? '当前账号是顾客账号，没有店铺。' : '登录商家账号后才能管理店铺。'}</p>
          <div className="flex gap-2">
            <Link to="/login?next=/merchant" className={`${BUTTON} no-underline`}>
              登录
            </Link>
            <Link to="/login?mode=register&role=merchant&next=/merchant" className={`${BUTTON_PRIMARY} no-underline hover:text-on-primary`}>
              注册商家账号
            </Link>
          </div>
        </div>
      </PageFrame>
    )
  }

  return (
    <PageFrame title="商家后台" aside={<span className="text-[13px] text-ink-muted">{subtitle}</span>}>
      <Pills<Section> label="后台栏目" value={section} options={SECTIONS} onChange={setSection} />
      {section === 'overview' && <Overview goTo={setSection} />}
      {section === 'products' && <Products />}
      {section === 'orders' && <Orders />}
      {section === 'shop' && <Shop />}
    </PageFrame>
  )
}
