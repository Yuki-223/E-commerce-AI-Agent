import type { ReactNode } from 'react'

/** 56px bar at the top of the main column. */
export function MainHeader({ title, children, bordered = true }: { title?: ReactNode; children?: ReactNode; bordered?: boolean }) {
  return (
    <div className={`flex h-14 shrink-0 items-center gap-3 px-6 ${bordered ? 'border-b border-line-faint' : ''}`}>
      <h1 className="m-0 min-w-0 grow truncate text-base font-semibold">{title}</h1>
      {children}
    </div>
  )
}
