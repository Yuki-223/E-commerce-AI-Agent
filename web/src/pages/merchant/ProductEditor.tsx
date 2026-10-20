import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { ApiError } from '../../api/http'
import { api } from '../../api/endpoints'
import type { MerchantProduct, MerchantSku, ProductCreateRequest, SkuBody } from '../../api/types'
import { CARD } from '../../components/layout/PageFrame'
import { MERCHANT_KEY } from '../../hooks/useCommerce'
import { toast } from '../../stores/toast'
import { BUTTON, BUTTON_PRIMARY, FIELD, TEXTAREA } from '../settings/ui'

/** "颜色:黑, 尺码:M" ⇄ {颜色: 黑, 尺码: M}; full-width colons and commas work too. */
export function parseProps(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of text.split(/[,，;；]/)) {
    const [k, ...rest] = part.split(/[:：=]/)
    const key = k?.trim()
    const value = rest.join(':').trim()
    if (key && value) out[key] = value
  }
  return out
}

export const propsText = (p: Record<string, string>) =>
  Object.entries(p)
    .map(([k, v]) => `${k}:${v}`)
    .join(', ')

const errText = (err: unknown) => (err instanceof ApiError ? err.message : '请稍后再试')

interface SkuDraft {
  sku_id?: string
  props: string
  price: string
  stock: string
  status: 'active' | 'inactive'
}

const toDraft = (s: MerchantSku): SkuDraft => ({ sku_id: s.sku_id, props: propsText(s.properties), price: String(s.price), stock: String(s.stock_qty), status: s.status })

function toBody(d: SkuDraft): SkuBody {
  return { sku_id: d.sku_id ?? null, properties: parseProps(d.props), price: Number(d.price), stock_qty: Math.floor(Number(d.stock)), status: d.status }
}

function SkuRow({ draft, onChange, onSave, saving }: { draft: SkuDraft; onChange: (d: SkuDraft) => void; onSave?: () => void; saving?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_88px_80px] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_96px_88px_88px_auto]">
      <input className={FIELD} placeholder="规格，如 颜色:黑, 尺码:M" value={draft.props} onChange={(e) => onChange({ ...draft, props: e.target.value })} aria-label="规格" />
      <input className={FIELD} inputMode="decimal" placeholder="价格" required value={draft.price} onChange={(e) => onChange({ ...draft, price: e.target.value })} aria-label="价格" />
      <input className={FIELD} inputMode="numeric" placeholder="库存" required value={draft.stock} onChange={(e) => onChange({ ...draft, stock: e.target.value })} aria-label="库存" />
      <select className={FIELD} value={draft.status} onChange={(e) => onChange({ ...draft, status: e.target.value as SkuDraft['status'] })} aria-label="SKU 状态">
        <option value="active">在售</option>
        <option value="inactive">停售</option>
      </select>
      {onSave && (
        <button type="button" disabled={saving} className={BUTTON} onClick={onSave}>
          保存
        </button>
      )}
    </div>
  )
}

/**
 * Publish a product, or edit one: basic fields save together, each SKU row
 * saves on its own (PUT /merchant/products/{id}/skus) so price and stock
 * changes take effect immediately.
 */
export function ProductEditor({ product, onDone }: { product?: MerchantProduct; onDone: () => void }) {
  const qc = useQueryClient()
  const [fields, setFields] = useState({
    title: product?.title ?? '',
    brand: product?.brand ?? '',
    category: product?.category ?? '',
    sub_category: product?.sub_category ?? '',
    image_url: product?.image_url ?? '',
    description: product?.description ?? '',
  })
  const [skus, setSkus] = useState<SkuDraft[]>(product ? product.skus.map(toDraft) : [{ props: '', price: '', stock: '', status: 'active' }])
  const [busy, setBusy] = useState(false)
  const refresh = () => qc.invalidateQueries({ queryKey: MERCHANT_KEY })
  const field = (key: keyof typeof fields) => ({
    value: fields[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFields((f) => ({ ...f, [key]: e.target.value })),
  })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      if (product) {
        // Bundled products carry a local image_path and no URL; leave that alone unless one is typed.
        const { image_url, ...rest } = fields
        await api.updateProduct(product.product_id, image_url.trim() ? fields : rest)
        toast({ tone: 'success', title: '商品信息已保存' })
      } else {
        const body: ProductCreateRequest = { ...fields, sub_category: fields.sub_category, skus: skus.map(toBody) }
        await api.createProduct(body)
        toast({ tone: 'success', title: '商品已发布', detail: 'AI 导购的检索索引会在后台同步。' })
      }
      await refresh()
      onDone()
    } catch (err) {
      toast({ tone: 'error', title: '保存失败', detail: errText(err) })
    } finally {
      setBusy(false)
    }
  }

  const saveSku = async (i: number) => {
    if (!product) return
    setBusy(true)
    try {
      const { product: saved } = await api.upsertSku(product.product_id, toBody(skus[i]))
      setSkus(saved.skus.map(toDraft))
      await refresh()
      toast({ tone: 'success', title: 'SKU 已保存' })
    } catch (err) {
      toast({ tone: 'error', title: 'SKU 保存失败', detail: errText(err) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className={`${CARD} flex flex-col gap-3 p-5`} aria-label={product ? '编辑商品' : '发布商品'}>
      <h2 className="m-0 text-[17px] font-semibold">{product ? `编辑：${product.title}` : '发布新商品'}</h2>
      <input className={FIELD} placeholder="商品标题" required maxLength={80} aria-label="商品标题" {...field('title')} />
      <div className="grid gap-3 sm:grid-cols-3">
        <input className={FIELD} placeholder="品牌" required maxLength={40} aria-label="品牌" {...field('brand')} />
        <input className={FIELD} placeholder="类目，如 数码电子" required maxLength={20} aria-label="类目" {...field('category')} />
        <input className={FIELD} placeholder="子类目，如 耳机" maxLength={20} aria-label="子类目" {...field('sub_category')} />
      </div>
      <input className={FIELD} placeholder={product ? '商品图片 URL（留空不修改）' : '商品图片 URL'} required={!product} maxLength={500} aria-label="图片 URL" {...field('image_url')} />
      <textarea
        className={TEXTAREA}
        placeholder="卖点、适用场景、使用建议——AI 导购会据此推荐和回答问题"
        maxLength={2000}
        aria-label="商品描述"
        {...field('description')}
      />
      <div className="flex flex-col gap-2">
        <span className="text-[13px] text-ink-muted">SKU（规格 · 价格 · 库存 · 状态）</span>
        {skus.map((d, i) => (
          <SkuRow
            key={d.sku_id ?? `new-${i}`}
            draft={d}
            saving={busy}
            onChange={(next) => setSkus((all) => all.map((x, j) => (j === i ? next : x)))}
            onSave={product ? () => void saveSku(i) : undefined}
          />
        ))}
        <button type="button" className={`${BUTTON} self-start`} onClick={() => setSkus((all) => [...all, { props: '', price: '', stock: '', status: 'active' }])}>
          + 添加 SKU
        </button>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className={BUTTON} onClick={onDone}>
          {product ? '关闭' : '取消'}
        </button>
        <button type="submit" disabled={busy} className={BUTTON_PRIMARY}>
          {product ? '保存商品信息' : '发布'}
        </button>
      </div>
    </form>
  )
}
