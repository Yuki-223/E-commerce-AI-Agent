import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useCart } from '../../hooks/useCart'
import { preferenceSummary, usePreference } from '../../hooks/usePreference'
import { usePresence } from '../../hooks/usePresence'
import { yuan } from '../../lib/format'
import { historyGroup } from '../../lib/format'
import { useConversations, type Conversation } from '../../stores/conversations'
import { isSeller, useAuth } from '../../stores/auth'
import { useActiveProfile } from '../../stores/profiles'
import { useDrawer, useSettings } from '../../stores/ui'
import { IconAddSquare, IconBox, IconCart, IconClose, IconCompose, IconCrown, IconSearch, IconUsers } from '../Icons'
import { Avatar } from './AccountButton'
import { HistoryList } from './HistoryItem'
import { InstallHint, useInstall } from '../../hooks/useInstall'

/** ⑬ MWebDrawer: history, cart, preferences and 添加到主屏幕. */
export function MobileDrawer() {
  const { open, set } = useDrawer()
  const navigate = useNavigate()
  const location = useLocation()
  const conversations = useConversations((s) => s.conversations)
  const { data: cart } = useCart()
  const profile = useActiveProfile()
  const { data: pref } = usePreference(profile.userId)
  const install = useInstall()
  const [query, setQuery] = useState('')
  const [hint, setHint] = useState(false)
  const openSettings = useSettings((s) => s.open)
  const account = useAuth((s) => s.account)
  const presence = usePresence(open)

  useEffect(() => set(false), [location.pathname, location.search, set])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && set(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, set])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const out = new Map<string, Conversation[]>()
    Object.values(conversations)
      .filter((c) => c.messages.length && (!q || c.title.toLowerCase().includes(q)))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .forEach((c) => out.set(historyGroup(c.updatedAt), [...(out.get(historyGroup(c.updatedAt)) ?? []), c]))
    return out
  }, [conversations, query])

  if (!presence.mounted) return null
  return (
    <div data-state={presence.state} className="fixed inset-0 z-50">
      <button type="button" aria-label="关闭菜单" onClick={() => set(false)} className="absolute inset-0 animate-fade-in closing-in:animate-drawer-scrim-out bg-[rgba(28,22,17,0.38)] p-0" />
      <nav
        aria-label="菜单"
        onAnimationEnd={presence.onAnimationEnd}
        className="absolute bottom-0 left-0 top-0 flex animate-drawer-in closing-in:animate-drawer-out w-[304px] max-w-[85vw] flex-col gap-3.5 bg-sidebar px-3.5 pb-[max(14px,env(safe-area-inset-bottom))] pt-[calc(8px+env(safe-area-inset-top))] shadow-[8px_0_30px_rgba(28,22,17,0.18)]"
      >
        <div className="flex items-center pl-2 pr-1">
          <div className="grow">
            <div className="font-logo text-2xl tracking-[0.3px]">CartPilot</div>
            <div className="text-xs font-medium text-ink-subtle">购物导购</div>
          </div>
          <button type="button" aria-label="关闭菜单" onClick={() => set(false)} className="flex h-11 w-11 items-center justify-center p-0 text-ink-muted">
            <IconClose size={14} />
          </button>
        </div>
        <button type="button" onClick={() => navigate('/')} className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-line-strong bg-surface text-[15px] font-semibold text-primary-text">
          <IconCompose />
          新对话
        </button>
        <label className="flex h-10 items-center gap-2 rounded-xl bg-overlay px-3 text-ink-subtle">
          <IconSearch />
          <span className="sr-only-label">搜索历史对话</span>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索历史对话" className="min-w-0 grow bg-transparent text-base text-ink outline-none" />
        </label>
        <div className="-mx-1 flex min-h-0 grow flex-col gap-0.5 overflow-y-auto px-1 text-[15px]">
          {groups.size === 0 && <p className="px-2 text-xs text-ink-subtle">{query ? '没有找到相关对话' : '还没有历史对话。'}</p>}
          {(['今天', '昨天', '更早'] as const)
            .filter((g) => groups.has(g))
            .map((g, i) => (
              <div key={g} className="flex flex-col gap-0.5">
                <div className={`px-2 pb-1 text-xs text-ink-subtle ${i ? 'pt-3' : 'pt-1.5'}`}>{g}</div>
                {/* Keyed by the query: filtering re-lists at once; only deletions collapse. */}
                <HistoryList key={query} conversations={groups.get(g)!} />
              </div>
            ))}
        </div>
        <div className="flex flex-col gap-0.5 border-t border-line-strong pt-2.5">
          <Link to="/cart" className="flex min-h-11 items-center gap-3 rounded-xl px-2.5 text-[15px] text-ink no-underline">
            <IconCart size={20} strokeWidth={2.1} className="text-primary-text" />
            <span className="grow">购物车</span>
            <span className="text-[13px] text-ink-subtle">
              {cart?.cart.item_count ?? 0} 件{cart?.cart.item_count ? ` · ${yuan(cart.cart.total)}` : ''}
            </span>
          </Link>
          <Link to="/orders" className="flex min-h-11 items-center gap-3 rounded-xl px-2.5 text-[15px] text-ink no-underline">
            <IconBox size={20} className="text-primary-text" />
            <span className="grow">我的订单</span>
          </Link>
          {isSeller(account) && (
            <Link to="/merchant" className="flex min-h-11 items-center gap-3 rounded-xl px-2.5 text-[15px] text-ink no-underline">
              <IconCrown size={20} className="text-primary-text" />
              <span className="grow">商家后台</span>
            </Link>
          )}
          {!account && (
            <Link to="/login" className="flex min-h-11 items-center gap-3 rounded-xl px-2.5 text-[15px] text-ink no-underline">
              <IconUsers size={20} className="text-primary-text" />
              <span className="grow">登录 / 注册</span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => (set(false), openSettings('preferences'))}
            className="flex min-h-11 items-center gap-3 rounded-xl px-2.5 text-left text-[15px] text-ink"
          >
            <Avatar profile={profile} size={22} />
            <span className="flex min-w-0 grow flex-col">
              <span>设置与偏好</span>
              <span className="truncate text-xs text-ink-subtle">{preferenceSummary(pref)}</span>
            </span>
          </button>
          {!install.installed && (
            <button
              type="button"
              onClick={() => (install.canPrompt ? void install.prompt() : setHint((h) => !h))}
              className="flex min-h-11 items-center gap-3 rounded-xl bg-primary-soft px-2.5 py-1.5 text-left text-[15px] text-ink"
            >
              <IconAddSquare className="text-primary-text" />
              <span className="flex grow flex-col">
                <span>添加到主屏幕</span>
                <span className="text-xs text-ink-subtle">像 App 一样全屏打开</span>
              </span>
            </button>
          )}
          {hint && <InstallHint />}
        </div>
      </nav>
    </div>
  )
}
