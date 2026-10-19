import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useCart } from '../../hooks/useCart'
import { useProducts } from '../../hooks/useProducts'
import type { ProductRef } from '../../lib/productRef'
import { profileLabel, useActiveProfile, useProfiles } from '../../stores/profiles'
import { useRecentProducts } from '../../stores/recentProducts'
import { toast } from '../../stores/toast'
import { useSettings } from '../../stores/ui'
import { IconBox, IconCamera, IconCheck, IconChevronLeft, IconChevronRight, IconImage } from '../Icons'
import { Avatar } from '../layout/AccountButton'
import { ProductImage } from '../product/ProductImage'

const ROW = 'flex min-h-[40px] w-full items-center gap-3 rounded-[10px] px-2.5 text-left text-sm text-ink hover:bg-secondary'

interface Props {
  onImage: () => void
  /** Present only on touch devices, where <input capture> opens the camera. */
  onCamera?: () => void
  onProduct: (ref: ProductRef) => void
  onClose: () => void
}

function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-1 px-1 pb-1">
      <button type="button" aria-label="返回" onClick={onBack} className="flex h-8 w-8 items-center justify-center rounded-lg p-0 text-ink-muted hover:bg-secondary">
        <IconChevronLeft />
      </button>
      <span className="text-sm font-semibold">{title}</span>
    </div>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <div className="px-2.5 pb-1 pt-2 text-xs text-ink-subtle">{label}</div>
      {children}
    </div>
  )
}

function ProductsView({ onBack, onPick }: { onBack: () => void; onPick: (ref: ProductRef) => void }) {
  const { data: cart } = useCart()
  const recent = useRecentProducts((s) => s.ids)
  const cartIds = useMemo(() => [...new Set((cart?.cart.lines ?? []).map((l) => l.product_id))], [cart])
  const recentIds = useMemo(() => recent.filter((id) => !cartIds.includes(id)), [recent, cartIds])
  const { data: products, isPending } = useProducts([...cartIds, ...recentIds])
  const byId = new Map((products ?? []).map((p) => [p.productID, p]))

  const rows = (ids: string[]) =>
    ids.map((id) => {
      const p = byId.get(id)
      if (!p) return null
      return (
        <button key={id} type="button" role="menuitem" onClick={() => onPick({ id, title: p.title })} className={`${ROW} py-1.5`}>
          <ProductImage src={p.imageURL} alt="" fit="cover" className="h-9 w-9 shrink-0 rounded-lg border border-line" />
          <span className="flex min-w-0 grow flex-col">
            <span className="truncate text-[13px]">{p.title}</span>
            <span className="text-xs text-ink-subtle">{p.price.display}</span>
          </span>
        </button>
      )
    })

  const empty = cartIds.length === 0 && recentIds.length === 0
  return (
    <>
      <Header title="引用商品" onBack={onBack} />
      <div className="-mx-1 max-h-[300px] overflow-y-auto px-1">
        {empty ? (
          <p className="m-0 px-3 py-6 text-center text-xs leading-5 text-ink-subtle">
            购物车是空的，也还没看过商品详情。
            <br />
            打开一件商品的详情后，它会出现在这里。
          </p>
        ) : isPending ? (
          <p className="m-0 px-3 py-6 text-center text-xs text-ink-subtle">正在加载…</p>
        ) : (
          <>
            {cartIds.length > 0 && <Section label="购物车">{rows(cartIds)}</Section>}
            {recentIds.length > 0 && <Section label="最近看过">{rows(recentIds)}</Section>}
          </>
        )}
      </div>
    </>
  )
}

function ProfilesView({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const { profiles, activeId, setActive } = useProfiles()
  const openSettings = useSettings((s) => s.open)
  return (
    <>
      <Header title="偏好档案" onBack={onBack} />
      <p className="m-0 px-2.5 pb-1.5 text-xs leading-[18px] text-ink-subtle">之后的推荐会按所选档案的预算和偏好来，购物车所有档案共用。</p>
      <div className="-mx-1 max-h-[240px] overflow-y-auto px-1">
        {profiles.map((p) => (
          <button
            key={p.id}
            type="button"
            role="menuitemradio"
            aria-checked={p.id === activeId}
            onClick={() => {
              if (p.id !== activeId) {
                setActive(p.id)
                toast({ title: `已切换到「${profileLabel(p)}」`, detail: '接下来的推荐会按这个档案来', tone: 'success' })
              }
              onDone()
            }}
            className={ROW}
          >
            <Avatar profile={p} size={24} />
            <span className="grow truncate">{profileLabel(p)}</span>
            {p.id === activeId && <IconCheck className="shrink-0 text-primary-text" />}
          </button>
        ))}
      </div>
      <div aria-hidden="true" className="mx-1 my-1 h-px bg-line" />
      <button type="button" role="menuitem" onClick={() => (onDone(), openSettings('profiles'))} className={`${ROW} text-ink-muted`}>
        <span className="w-6" />
        管理档案…
      </button>
    </>
  )
}

/**
 * The composer's + menu: 添加图片 / 拍照 (touch only) / 引用商品 ▸ / 偏好档案 ▸.
 * Submenus replace the root list in place, like claude.ai's.
 */
export function ComposerMenu({ onImage, onCamera, onProduct, onClose }: Props) {
  const [view, setView] = useState<'root' | 'products' | 'profiles'>('root')
  const profile = useActiveProfile()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => !ref.current?.parentElement?.contains(e.target as Node) && onClose()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (view === 'root' ? onClose() : setView('root'))
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose, view])

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="添加内容"
      className="absolute bottom-[calc(100%+10px)] left-0 z-40 flex origin-bottom-left animate-pop-in w-[290px] max-w-[calc(100vw-32px)] flex-col rounded-2xl border border-line-strong bg-surface p-1.5 shadow-pop"
    >
      {view === 'root' && (
        <>
          <button type="button" role="menuitem" onClick={() => (onClose(), onImage())} className={ROW}>
            <IconImage className="w-6 shrink-0 text-ink-muted" />
            <span className="grow">添加图片</span>
            <span className="text-xs text-ink-subtle">JPG / PNG</span>
          </button>
          {onCamera && (
            <button type="button" role="menuitem" onClick={() => (onClose(), onCamera())} className={ROW}>
              <IconCamera className="w-6 shrink-0 text-ink-muted" />
              <span className="grow">拍照</span>
            </button>
          )}
          <button type="button" role="menuitem" aria-haspopup="menu" onClick={() => setView('products')} className={ROW}>
            <IconBox className="w-6 shrink-0 text-ink-muted" />
            <span className="grow">引用商品</span>
            <span className="text-xs text-ink-subtle">购物车 · 最近看过</span>
            <IconChevronRight className="shrink-0 text-ink-subtle" />
          </button>
          <div aria-hidden="true" className="mx-1 my-1 h-px bg-line" />
          <button type="button" role="menuitem" aria-haspopup="menu" onClick={() => setView('profiles')} className={ROW}>
            <span className="flex w-6 shrink-0 justify-center">
              <Avatar profile={profile} size={20} />
            </span>
            <span className="grow">偏好档案</span>
            <span className="max-w-[96px] truncate text-xs text-ink-subtle">{profileLabel(profile)}</span>
            <IconChevronRight className="shrink-0 text-ink-subtle" />
          </button>
        </>
      )}
      {view === 'products' && <ProductsView onBack={() => setView('root')} onPick={(r) => (onClose(), onProduct(r))} />}
      {view === 'profiles' && <ProfilesView onBack={() => setView('root')} onDone={onClose} />}
    </div>
  )
}
