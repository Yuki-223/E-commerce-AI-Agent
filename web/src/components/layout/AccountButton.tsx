import { Link } from 'react-router-dom'
import { preferenceSummary, usePreference } from '../../hooks/usePreference'
import { useActiveProfile } from '../../stores/profiles'
import { IconGear } from '../Icons'

/** Sidebar footer. Step 11 turns this into the account menu (WebAccountMenu). */
export function AccountButton() {
  const profile = useActiveProfile()
  const { data } = usePreference(profile.userId)
  return (
    <Link
      to="/settings/preferences"
      className="flex items-center gap-2.5 rounded-xl bg-overlay p-2.5 text-ink no-underline hover:text-ink"
    >
      <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full font-bold text-white" style={{ background: profile.color }}>
        {Array.from(profile.name)[0]}
      </span>
      <span className="flex min-w-0 grow flex-col">
        <span className="text-sm font-semibold">{profile.name}</span>
        <span className="truncate text-xs text-ink-subtle">{preferenceSummary(data)}</span>
      </span>
      <IconGear className="text-ink-subtle" />
    </Link>
  )
}
