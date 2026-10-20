import { useEffect, useRef, useState } from 'react'
import { usePresence } from '../../hooks/usePresence'
import { profileLabel, useActiveProfile } from '../../stores/profiles'
import { IconChevronDown } from '../Icons'
import { ProfilesView } from './ComposerMenu'

/** 「档案：我 ▾」under the home composer; opens the shared profile switcher below it. */
export function ProfilePicker({ className = '' }: { className?: string }) {
  const profile = useActiveProfile()
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const menu = usePresence(open)

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

  return (
    <div ref={wrap} className="relative min-w-0">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex max-w-full items-center gap-1 rounded-lg bg-transparent px-2 text-[13px] text-ink-muted hover:bg-secondary hover:text-ink ${open ? 'bg-secondary text-ink' : ''} ${className}`}
      >
        <span className="truncate">档案：{profileLabel(profile)}</span>
        <IconChevronDown size={10} className={`shrink-0 transition-transform duration-snap ease-snap ${open ? 'rotate-180' : ''}`} />
      </button>
      {menu.mounted && (
        <div
          {...menu.props}
          role="menu"
          aria-label="切换偏好档案"
          className="absolute left-0 top-[calc(100%+6px)] z-40 flex w-[280px] max-w-[calc(100vw-32px)] origin-top-left animate-pop-up closing:animate-pop-up-out flex-col rounded-2xl border border-line-strong bg-surface p-1.5 shadow-pop"
        >
          <ProfilesView onDone={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}
