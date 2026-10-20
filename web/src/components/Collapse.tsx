import { useState, type ReactNode } from 'react'
import { usePresence, type PresenceProps } from '../hooks/usePresence'

/**
 * Height in / out for banners and list rows (dur-base, ease-out): a one-row
 * grid animates 0fr ↔ 1fr with opacity, so the content below moves with it.
 * The inner box clips only while animating, so shadows show once settled.
 */
export function CollapseBox({ presence, appear = true, exit = 'base', className = '', children }: { presence: PresenceProps; appear?: boolean; exit?: 'base' | 'snap'; className?: string; children: ReactNode }) {
  const [moving, setMoving] = useState(appear)
  return (
    <div
      data-state={presence['data-state']}
      onAnimationStart={(e) => e.target === e.currentTarget && setMoving(true)}
      onAnimationEnd={(e) => {
        if (e.target !== e.currentTarget) return
        setMoving(false)
        presence.onAnimationEnd(e)
      }}
      className={`grid grid-rows-[1fr] ${exit === 'snap' ? 'closing:animate-collapse-out-snap' : 'closing:animate-collapse-out'} ${appear ? 'animate-expand-in' : ''} ${className}`}
    >
      <div className={`min-h-0 ${moving || presence['data-state'] === 'closed' ? 'overflow-hidden' : ''}`}>{children}</div>
    </div>
  )
}

/** Mounts `children` while `show`, expanding in and collapsing out. */
export function Collapse({ show, appear = true, exit, className, children }: { show: boolean; appear?: boolean; exit?: 'base' | 'snap'; className?: string; children: ReactNode }) {
  const presence = usePresence(show)
  if (!presence.mounted) return null
  return (
    <CollapseBox presence={presence.props} appear={appear} exit={exit} className={className}>
      {children}
    </CollapseBox>
  )
}
