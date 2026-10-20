import { useEffect, useRef, type ComponentType } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { IconBox, IconClose, IconDatabase, IconGear, IconMoon, IconSliders, IconUsers } from '../../components/Icons'
import { useIsNarrow } from '../../hooks/useIsNarrow'
import { usePresence } from '../../hooks/usePresence'
import { useSettings, type SettingsTab } from '../../stores/ui'
import { PreferencePage } from '../PreferencePage'
import { AddressSettings } from './AddressSettings'
import { CycleSettings } from './CycleSettings'
import { DataSettings } from './DataSettings'
import { GeneralSettings } from './GeneralSettings'
import { ProfileSettings } from './ProfileSettings'
import { SECTIONS } from './ui'

export const SETTINGS_TABS: { id: SettingsTab; label: string; Icon: typeof IconGear; Page: ComponentType }[] = [
  { id: 'general', label: '通用', Icon: IconGear, Page: GeneralSettings },
  { id: 'preferences', label: '身体与偏好', Icon: IconSliders, Page: PreferencePage },
  { id: 'cycle', label: '经期关怀', Icon: IconMoon, Page: CycleSettings },
  { id: 'profiles', label: '偏好档案', Icon: IconUsers, Page: ProfileSettings },
  { id: 'addresses', label: '收货地址', Icon: IconBox, Page: AddressSettings },
  { id: 'data', label: '数据与存储', Icon: IconDatabase, Page: DataSettings },
]

/** Old /settings/:tab links open the dialog over the home page. */
export function SettingsRedirect() {
  const { tab } = useParams()
  const open = useSettings((s) => s.open)
  const known = SETTINGS_TABS.find((t) => t.id === tab)?.id ?? 'general'
  useEffect(() => open(known), [open, known])
  return <Navigate to="/" replace />
}

/**
 * Settings as a floating window over the app, like claude.ai: a serif title,
 * an icon tab list on the left and one column of sections on the right.
 * On phones it fills the screen and the tabs become a scrolling strip.
 */
export function SettingsDialog() {
  const { tab, open, close } = useSettings()
  const narrow = useIsNarrow()
  const panel = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const presence = usePresence(!!tab)
  // Keep showing the last tab while the window plays its exit.
  const lastTab = useRef(tab)
  if (tab) lastTab.current = tab

  useEffect(() => {
    if (!tab) return
    const onKey = (e: KeyboardEvent) => {
      // Let nested dialogs (history manager, clear confirmation) take Escape first.
      const nested = [...document.querySelectorAll('[role=alertdialog], [aria-label="管理历史对话"]')].some((el) => !el.closest('[data-state=closed]'))
      if (e.key === 'Escape' && !nested) close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [tab, close])

  useEffect(() => {
    body.current?.scrollTo({ top: 0 })
  }, [tab])

  if (!presence.mounted) return null
  const current = SETTINGS_TABS.find((t) => t.id === (tab ?? lastTab.current)) ?? SETTINGS_TABS[0]
  const { Page } = current

  const closeButton = (
    <button type="button" aria-label="关闭设置" onClick={close} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg p-0 text-ink-muted hover:bg-secondary hover:text-ink">
      <IconClose size={14} strokeWidth={2.2} />
    </button>
  )

  return (
    <div
      {...presence.props}
      className="fixed inset-0 z-[45] flex animate-fade-in closing:animate-fade-out items-center justify-center bg-[rgba(20,16,12,0.36)] backdrop-blur-[2px] md:p-6"
      onMouseDown={(e) => !panel.current?.contains(e.target as Node) && close()}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="设置"
        className={
          narrow
            ? 'flex h-[100dvh] w-full animate-fade-in closing-in:animate-fade-out flex-col bg-bg pt-[env(safe-area-inset-top)]'
            : 'flex h-[min(720px,calc(100dvh-48px))] animate-dialog-in closing-in:animate-dialog-out w-[920px] max-w-full overflow-hidden rounded-2xl border border-line-strong bg-bg shadow-[0_24px_64px_rgba(20,16,12,0.24),0_2px_8px_rgba(20,16,12,0.08)]'
        }
      >
        {narrow ? (
          <>
            <div className="flex h-14 shrink-0 items-center gap-2 pl-4 pr-2">
              <h1 className="m-0 grow font-serif text-[22px] font-normal">设置</h1>
              {closeButton}
            </div>
            <nav aria-label="设置分类" className="flex shrink-0 gap-1 overflow-x-auto border-b border-line-faint px-3 pb-2">
              {SETTINGS_TABS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-current={id === current.id ? 'page' : undefined}
                  onClick={() => open(id)}
                  className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm ${id === current.id ? 'bg-secondary font-medium text-ink' : 'text-ink-muted'}`}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </nav>
          </>
        ) : (
          <nav aria-label="设置分类" className="flex w-[220px] shrink-0 flex-col gap-0.5 border-r border-line bg-sidebar px-3 pb-4 pt-6">
            <h1 className="m-0 mb-5 px-3 font-serif text-[26px] font-normal tracking-[0.2px]">设置</h1>
            {SETTINGS_TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                aria-current={id === current.id ? 'page' : undefined}
                onClick={() => open(id)}
                className={`flex h-9 items-center gap-2.5 rounded-lg px-3 text-left text-sm ${
                  id === current.id ? 'bg-[color-mix(in_srgb,var(--text-primary)_7%,transparent)] font-medium text-ink' : 'text-ink-muted hover:bg-[color-mix(in_srgb,var(--text-primary)_4%,transparent)] hover:text-ink'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>
        )}
        <div className="relative flex min-w-0 grow flex-col">
          {!narrow && <div className="absolute right-3 top-3 z-10">{closeButton}</div>}
          <div ref={body} className={`min-h-0 grow overflow-y-auto ${narrow ? 'px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-6' : 'px-12 pb-12 pt-10'}`}>
            <div className={`max-w-[620px] ${SECTIONS}`}>
              <Page />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
