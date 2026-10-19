import { NavLink, Outlet } from 'react-router-dom'
import { BackButton, MenuButton, MobileHeader, MobileTitle } from '../../components/layout/MobileHeader'
import { useIsNarrow } from '../../hooks/useIsNarrow'
import { SECTIONS } from './ui'

export const SETTINGS_TABS = [
  { to: 'general', label: '通用' },
  { to: 'preferences', label: '购物偏好' },
  { to: 'profiles', label: '偏好档案' },
  { to: 'data', label: '数据与存储' },
] as const

/**
 * /settings/*, laid out like claude.ai/settings: a page title, a vertical tab
 * list on the left and one narrow column of sections on the right. On phones
 * the tabs become a horizontally scrolling strip under the header.
 */
export function SettingsLayout() {
  const narrow = useIsNarrow()

  if (narrow) {
    return (
      <>
        <MobileHeader left={<BackButton to="/" />} right={<MenuButton />}>
          <MobileTitle>设置</MobileTitle>
        </MobileHeader>
        <nav aria-label="设置分类" className="flex shrink-0 gap-1 overflow-x-auto border-b border-line-faint px-3 py-2">
          {SETTINGS_TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `flex h-8 shrink-0 items-center rounded-lg px-3 text-sm no-underline ${isActive ? 'bg-secondary font-medium text-ink' : 'text-ink-muted'}`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="min-h-0 grow overflow-y-auto px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-5">
          <div className={SECTIONS}>
            <Outlet />
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="min-h-0 grow overflow-y-auto">
      <div className="mx-auto flex w-full max-w-[960px] flex-col px-10 pb-16 pt-12">
        <h1 className="m-0 mb-8 font-logo text-[28px] font-normal tracking-[0.2px]">设置</h1>
        <div className="flex items-start gap-10">
          <nav aria-label="设置分类" className="sticky top-0 flex w-[180px] shrink-0 flex-col gap-0.5">
            {SETTINGS_TABS.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  `flex h-9 items-center rounded-lg px-3 text-sm no-underline hover:text-ink ${isActive ? 'bg-secondary font-medium text-ink' : 'text-ink-muted hover:bg-[color-mix(in_srgb,var(--secondary)_60%,transparent)]'}`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
          <div className={`min-w-0 max-w-[680px] grow ${SECTIONS}`}>
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
