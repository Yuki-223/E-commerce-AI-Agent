import { useEffect, useMemo, useState, type ReactNode, type TransitionEvent } from 'react'
import { Link, useMatch, useNavigate } from 'react-router-dom'
import { useCart } from '../../hooks/useCart'
import { useBump } from '../../hooks/useBump'
import { usePresence } from '../../hooks/usePresence'
import { useConversations } from '../../stores/conversations'
import { useSidebar } from '../../stores/ui'
import { IconCart, IconPlus, IconSearch, IconSidebar } from '../Icons'
import { AccountButton } from './AccountButton'
import { HistoryList } from './HistoryItem'
import { SearchDialog } from './SearchDialog'

/** Apple keyboards show ⌘K; everyone else gets Ctrl K. */
const IS_MAC =
  typeof navigator !== 'undefined' &&
  /mac|iphone|ipad/i.test((navigator as Navigator & { userAgentData?: { platform: string } }).userAgentData?.platform ?? navigator.platform)

const ROW = 'flex h-10 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[15px] text-ink no-underline hover:bg-sidebar-hover hover:text-ink'
const RAIL_BTN = 'flex h-9 w-9 items-center justify-center rounded-lg p-0 text-ink-muted hover:bg-sidebar-hover hover:text-ink'

/** 新对话 is always tinted with the neutral active fill, with a black "+", as in claude.ai. */
const NEW_CHAT = 'bg-sidebar-active hover:bg-sidebar-active hover:text-ink active:bg-sidebar-hover'

function RailButton({ label, onClick, children, to }: { label: string; onClick?: () => void; children: ReactNode; to?: string }) {
  if (to)
    return (
      <Link to={to} aria-label={label} title={label} className={RAIL_BTN}>
        {children}
      </Link>
    )
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={RAIL_BTN}>
      {children}
    </button>
  )
}

/**
 * Desktop sidebar in the claude.ai / classic style: logo + collapse toggle,
 * flat nav rows (新对话 · 搜索 drawn as a field with a ⌘K / Ctrl K hint · 购物车), a
 * single-line 最近 list, account row pinned to the bottom. Collapsed, it becomes a 56px icon rail.
 */
export function Sidebar() {
  const navigate = useNavigate()
  const { collapsed, toggle: flip } = useSidebar()
  // Clip only while the width animates, so popovers can overflow the rail.
  const [sliding, setSliding] = useState(false)
  const toggle = () => {
    setSliding(true)
    flip()
  }
  const shell = (width: string) => ({
    className: `${width} shrink-0 border-r border-line bg-sidebar transition-[width] duration-sheet ease-snap ${sliding ? 'overflow-hidden' : ''}`,
    onTransitionEnd: (e: TransitionEvent) => e.target === e.currentTarget && setSliding(false),
  })
  const conversations = useConversations((s) => s.conversations)
  const { data: cart } = useCart()
  const cartCount = cart?.cart.item_count ?? 0
  const bump = useBump(cartCount)
  const onCart = useMatch('/cart')
  const [searching, setSearching] = useState(false)

  // ⌘K / Ctrl+K opens the search window, as in claude.ai.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearching((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const list = useMemo(
    () =>
      Object.values(conversations)
        .filter((c) => c.messages.length > 0)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations],
  )
  const search = usePresence(searching)
  const dialog = search.mounted && <SearchDialog presence={search.props} onClose={() => setSearching(false)} />

  if (collapsed) {
    return (
      <aside {...shell('w-14')}>
        <div className={`flex h-full w-14 flex-col items-center gap-1 pb-3 pt-2.5 ${sliding ? 'animate-fade-in-snap' : ''}`}>
          <RailButton label="展开侧栏" onClick={toggle}>
            <IconSidebar />
          </RailButton>
          <button type="button" aria-label="新对话" title="新对话" onClick={() => navigate('/')} className={`${RAIL_BTN} ${NEW_CHAT} mt-2 text-ink`}>
            <IconPlus size={14} strokeWidth={2.4} />
          </button>
          <RailButton label="搜索对话" onClick={() => setSearching(true)}>
            <IconSearch size={16} />
          </RailButton>
          <RailButton label={`购物车（${cartCount} 件）`} to="/cart">
            <span className="relative">
              <IconCart size={18} strokeWidth={2} />
              {cartCount > 0 && <span key={bump.key} className={`absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-primary ${bump.className}`} />}
            </span>
          </RailButton>
          <div className="grow" />
          <AccountButton compact />
        </div>
        {dialog}
      </aside>
    )
  }

  return (
    <aside {...shell('w-[260px]')}>
      {/* The swapped-in contents fade in while the width moves, instead of cutting over. */}
      <div className={`flex h-full w-[260px] flex-col ${sliding ? 'animate-fade-in-snap' : ''}`}>
        <div className="flex h-14 shrink-0 items-center justify-between pl-4 pr-2.5">
          <Link to="/" className="font-logo text-[21px] tracking-[0.3px] text-ink no-underline hover:text-ink">
            CartPilot
          </Link>
          <button type="button" aria-label="收起侧栏" title="收起侧栏" onClick={toggle} className={RAIL_BTN}>
            <IconSidebar />
          </button>
        </div>

        <nav aria-label="主导航" className="flex shrink-0 flex-col gap-px px-2.5 pb-2">
          <button type="button" onClick={() => navigate('/')} className={`${ROW} ${NEW_CHAT} font-medium`}>
            <span className="flex w-6 justify-center">
              <IconPlus size={16} strokeWidth={2.4} />
            </span>
            新对话
          </button>
          <button
            type="button"
            aria-label="搜索对话"
            aria-keyshortcuts={IS_MAC ? 'Meta+K' : 'Control+K'}
            onClick={() => setSearching(true)}
            className="my-1 flex h-9 w-full items-center gap-2.5 rounded-lg border border-line-strong bg-field px-[7px] text-left text-[15px] text-ink-subtle transition-colors duration-fast hover:border-ink-subtle hover:text-ink-muted"
          >
            <span className="flex w-6 justify-center">
              <IconSearch size={17} />
            </span>
            <span className="grow">搜索</span>
            <kbd aria-hidden className="font-sans text-xs text-ink-subtle">
              {IS_MAC ? '⌘K' : 'Ctrl K'}
            </kbd>
          </button>
          <Link to="/cart" className={`${ROW} ${onCart ? 'bg-sidebar-active' : ''}`}>
            <span className="flex w-6 justify-center text-ink-muted">
              <IconCart size={19} strokeWidth={1.9} />
            </span>
            <span className="grow">购物车</span>
            {cartCount > 0 && (
              // On /cart the row already has the active fill, so the count sits on surface instead.
              <span key={bump.key} className={`rounded-full px-1.5 text-xs font-semibold leading-5 text-ink-muted ${onCart ? 'bg-surface' : 'bg-sidebar-active'} ${bump.className}`}>
                {cartCount}
              </span>
            )}
          </Link>
        </nav>

        <nav aria-label="历史对话" className="flex min-h-0 grow flex-col overflow-y-auto px-2.5 pb-2">
          <div className="px-2 pb-1 pt-3 text-xs font-medium text-ink-subtle">最近</div>
          {list.length === 0 && (
            <p className="m-0 px-2 py-2 text-xs leading-[18px] text-ink-subtle">
              还没有历史对话。新对话会自动保存在这台设备上。
            </p>
          )}
          <HistoryList conversations={list} dense />
        </nav>

        <div className="shrink-0 border-t border-line px-2.5 py-2">
          <AccountButton />
        </div>
      </div>
      {dialog}
    </aside>
  )
}
