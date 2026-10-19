import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../../hooks/useCart'
import { preferenceSummary, usePreference } from '../../hooks/usePreference'
import { profileLabel, useActiveProfile, type Profile } from '../../stores/profiles'
import { useTheme, type ThemeChoice } from '../../stores/theme'
import { IconCart, IconChevronRight, IconGear, IconHelp, IconHistory, IconMonitor, IconMoon, IconSliders, IconSun } from '../Icons'
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

const THEMES: { value: ThemeChoice; label: string; Icon: typeof IconSun }[] = [
  { value: 'light', label: '浅色', Icon: IconSun },
  { value: 'dark', label: '深色', Icon: IconMoon },
  { value: 'system', label: '跟随系统', Icon: IconMonitor },
]

const ITEM = 'flex min-h-[46px] items-center gap-3 rounded-xl px-3 text-[15px] text-ink no-underline hover:bg-secondary hover:text-ink'

/** Sidebar footer + ㊒ WebAccountMenu popover. */
export function AccountButton() {
  const profile = useActiveProfile()
  const { data } = usePreference(profile.userId)
  const { data: cart } = useCart()
  const theme = useTheme()
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const close = () => setOpen(false)

  return (
    <div ref={wrap} className="relative">
      {open && (
        <div
          role="menu"
          aria-label="账户菜单"
          className="absolute bottom-[calc(100%+8px)] left-0 z-40 flex w-[300px] flex-col rounded-[18px] border border-line-strong bg-surface p-2 shadow-[0_18px_48px_rgba(43,30,18,0.18),0_2px_6px_rgba(43,30,18,0.06)]"
        >
          <Link role="menuitem" to="/settings/preferences" onClick={close} className="flex min-h-[54px] items-center gap-3 rounded-xl bg-secondary px-3 text-ink no-underline hover:text-ink">
            <IconSliders />
            <span className="flex grow flex-col gap-px">
              <span className="text-[15px] font-semibold">偏好管理</span>
              <span className="text-xs text-ink-muted">当前档案：{profileLabel(profile)}</span>
            </span>
            <IconChevronRight className="text-ink-subtle" />
          </Link>
          <div aria-hidden="true" className="mx-1 my-1.5 h-px bg-line" />
          <Link role="menuitem" to="/settings/general" onClick={close} className={ITEM}>
            <IconGear />
            <span className="grow">设置</span>
          </Link>
          <Link role="menuitem" to="/cart" onClick={close} className={ITEM}>
            <IconCart size={18} strokeWidth={2.1} />
            <span className="grow">购物车</span>
            <span className="text-xs text-ink-subtle">{cart?.cart.item_count ?? 0} 件</span>
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close()
              setHistory(true)
            }}
            className={`${ITEM} text-left`}
          >
            <IconHistory />
            <span className="grow">管理历史对话</span>
          </button>
          <a role="menuitem" href="https://github.com/Yuki-223/E-commerce-AI-Agent#readme" target="_blank" rel="noreferrer" onClick={close} className={ITEM}>
            <IconHelp />
            <span className="grow">帮助与反馈</span>
            <IconChevronRight className="text-ink-subtle" />
          </a>
          <div aria-hidden="true" className="mx-1 my-1.5 h-px bg-line" />
          <div role="radiogroup" aria-label="外观" className="flex items-center gap-1.5 px-1.5 pb-1 pt-1.5">
            {THEMES.map(({ value, label, Icon }) => {
              const on = theme.choice === value
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={label}
                  onClick={() => theme.set(value)}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl p-0 ${
                    on ? 'border border-line-strong bg-secondary text-ink shadow-[0_1px_3px_rgba(43,30,18,0.08)]' : 'border border-transparent text-ink-muted'
                  }`}
                >
                  <Icon />
                </button>
              )
            })}
            <span className="grow pr-1.5 text-right text-xs text-ink-subtle">外观：{THEMES.find((t) => t.value === theme.choice)?.label}</span>
          </div>
          <div className="flex flex-col gap-1 px-2.5 pb-1.5 pt-2 text-xs text-ink-subtle">
            <span>CartPilot · MIT License</span>
            <span>
              <a href="https://github.com/YufanPeter/E-commerce-AI-Agent" target="_blank" rel="noreferrer" className="text-ink-muted">
                GitHub
              </a>
              {' · '}
              <a
                href="https://github.com/YufanPeter/E-commerce-AI-Agent/blob/main/docs/%E7%B3%BB%E7%BB%9F%E8%AE%BE%E8%AE%A1%E6%96%87%E6%A1%A3.md"
                target="_blank"
                rel="noreferrer"
                className="text-ink-muted"
              >
                系统设计文档
              </a>
            </span>
          </div>
        </div>
      )}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={open ? '关闭账户菜单' : '打开账户菜单'}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left text-ink ${open ? 'border-[1.5px] border-primary bg-surface' : 'border-[1.5px] border-transparent bg-overlay'}`}
      >
        <Avatar profile={profile} />
        <span className="flex min-w-0 grow flex-col">
          <span className="text-sm font-semibold">{profileLabel(profile)}</span>
          <span className="truncate text-xs text-ink-subtle">{preferenceSummary(data)}</span>
        </span>
        <IconGear className="text-ink-subtle" />
      </button>
      {history && <HistoryManagerDialog onClose={() => setHistory(false)} />}
    </div>
  )
}
