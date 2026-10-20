import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../../hooks/useCart'
import { preferenceSummary, usePreference } from '../../hooks/usePreference'
import { profileLabel, useActiveProfile, type Profile } from '../../stores/profiles'
import { useSettings } from '../../stores/ui'
import { ProfilesView } from '../chat/ComposerMenu'
import { IconCart, IconChevronRight, IconChevronUpDown, IconGear, IconHelp, IconHistory, IconUsers } from '../Icons'
import { HistoryManagerDialog } from './HistoryManagerDialog'

export function Avatar({ profile, size = 32 }: { profile: Profile; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ background: profile.color, width: size, height: size, fontSize: size * 0.44 }}
    >
      {Array.from(profile.name)[0]}
    </span>
  )
}

const ROW = 'flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm text-ink no-underline hover:bg-secondary hover:text-ink'
const ICON = 'flex w-5 shrink-0 justify-center text-ink-muted'
const REPO = 'https://github.com/Yuki-223/E-commerce-AI-Agent'

/**
 * Sidebar footer + account menu, compact like claude.ai's: a header with the
 * active profile (opens 购物偏好), 切换档案 ▸, then 36px rows and a one-line
 * footer. `compact` is the collapsed rail's avatar-only button.
 */
export function AccountButton({ compact = false }: { compact?: boolean }) {
  const profile = useActiveProfile()
  const { data } = usePreference(profile.userId)
  const { data: cart } = useCart()
  const openSettings = useSettings((s) => s.open)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'root' | 'profiles'>('root')
  const [history, setHistory] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  const close = () => {
    setOpen(false)
    setView('root')
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && close()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (view === 'root' ? close() : setView('root'))
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, view])

  return (
    <div ref={wrap} className="relative">
      {open && (
        <div
          role="menu"
          aria-label="账户菜单"
          className={`absolute bottom-[calc(100%+8px)] left-0 z-40 flex origin-bottom-left animate-pop-in ${compact ? 'w-[280px]' : 'right-0'} flex-col rounded-2xl border border-line-strong bg-surface p-1.5 shadow-pop`}
        >
          {view === 'profiles' ? (
            <ProfilesView onBack={() => setView('root')} onDone={close} />
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                title="编辑购物偏好"
                onClick={() => (close(), openSettings('preferences'))}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-ink hover:bg-secondary"
              >
                <Avatar profile={profile} size={28} />
                <span className="flex min-w-0 grow flex-col">
                  <span className="truncate text-sm font-semibold">{profileLabel(profile)}</span>
                  <span className="truncate text-xs text-ink-subtle">{preferenceSummary(data)}</span>
                </span>
              </button>
              <button type="button" role="menuitem" aria-haspopup="menu" onClick={() => setView('profiles')} className={ROW}>
                <span className={ICON}>
                  <IconUsers size={16} />
                </span>
                <span className="grow">切换档案</span>
                <IconChevronRight className="shrink-0 text-ink-subtle" />
              </button>
              <div aria-hidden="true" className="mx-1 my-1 h-px bg-line" />
              <button type="button" role="menuitem" onClick={() => (close(), openSettings('general'))} className={ROW}>
                <span className={ICON}>
                  <IconGear size={16} />
                </span>
                <span className="grow">设置</span>
              </button>
              <Link role="menuitem" to="/cart" onClick={close} className={ROW}>
                <span className={ICON}>
                  <IconCart size={16} strokeWidth={2.1} />
                </span>
                <span className="grow">购物车</span>
                <span className="text-xs text-ink-subtle">{cart?.cart.item_count ?? 0} 件</span>
              </Link>
              <button type="button" role="menuitem" onClick={() => (close(), setHistory(true))} className={ROW}>
                <span className={ICON}>
                  <IconHistory size={16} />
                </span>
                <span className="grow">管理历史对话</span>
              </button>
              <a role="menuitem" href={`${REPO}#readme`} target="_blank" rel="noreferrer" onClick={close} className={ROW}>
                <span className={ICON}>
                  <IconHelp size={16} />
                </span>
                <span className="grow">帮助与反馈</span>
                <span aria-hidden="true" className="text-xs text-ink-subtle">↗</span>
              </a>
              <div aria-hidden="true" className="mx-1 my-1 h-px bg-line" />
              <div className="px-2.5 pb-1 pt-1.5 text-xs text-ink-subtle">
                CartPilot · MIT ·{' '}
                <a href={REPO} target="_blank" rel="noreferrer" className="text-ink-subtle hover:text-ink">
                  GitHub
                </a>
                {' · '}
                <a href={`${REPO}/blob/main/docs/%E7%B3%BB%E7%BB%9F%E8%AE%BE%E8%AE%A1%E6%96%87%E6%A1%A3.md`} target="_blank" rel="noreferrer" className="text-ink-subtle hover:text-ink">
                  设计文档
                </a>
              </div>
            </>
          )}
        </div>
      )}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={open ? '关闭账户菜单' : '打开账户菜单'}
        title={compact ? profileLabel(profile) : undefined}
        onClick={() => (open ? close() : setOpen(true))}
        className={
          compact
            ? `flex h-10 w-10 items-center justify-center rounded-lg p-0 hover:bg-sidebar-hover ${open ? 'bg-sidebar-active' : ''}`
            : `flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-ink hover:bg-sidebar-hover ${open ? 'bg-sidebar-active hover:bg-sidebar-active' : ''}`
        }
      >
        <Avatar profile={profile} size={compact ? 30 : 32} />
        {!compact && (
          <>
            <span className="flex min-w-0 grow flex-col">
              <span className="text-sm font-semibold">{profileLabel(profile)}</span>
              <span className="truncate text-xs text-ink-subtle">{preferenceSummary(data)}</span>
            </span>
            <IconChevronUpDown className="shrink-0 text-ink-subtle" />
          </>
        )}
      </button>
      {history && <HistoryManagerDialog onClose={() => setHistory(false)} />}
    </div>
  )
}
