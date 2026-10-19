import { useEffect, useState } from 'react'
import { Avatar } from '../../components/layout/AccountButton'
import { AVATAR_COLORS, useActiveProfile, useProfiles } from '../../stores/profiles'
import { useTheme, type ThemeChoice } from '../../stores/theme'
import { FIELD, Row, Section } from './ui'

/** Fixed swatches so the previews show each mode regardless of the current theme. */
const PREVIEW = {
  light: { bg: '#FBFAF7', side: '#F0EAE2', line: '#E3DBD1', accent: '#CE8763' },
  dark: { bg: '#1E1A16', side: '#13110F', line: '#3A332C', accent: '#EBA886' },
}

function MiniWindow({ mode }: { mode: 'light' | 'dark' }) {
  const c = PREVIEW[mode]
  return (
    <div className="flex h-full w-full" style={{ background: c.bg }}>
      <div className="flex w-[30%] flex-col gap-1.5 p-2" style={{ background: c.side }}>
        <span className="h-1.5 w-3/4 rounded-full" style={{ background: c.line }} />
        <span className="h-1.5 w-1/2 rounded-full" style={{ background: c.line }} />
        <span className="h-1.5 w-2/3 rounded-full" style={{ background: c.line }} />
      </div>
      <div className="flex grow flex-col justify-end gap-1.5 p-2.5">
        <span className="h-1.5 w-1/2 self-end rounded-full" style={{ background: c.line }} />
        <span className="h-1.5 w-4/5 rounded-full" style={{ background: c.line }} />
        <span className="h-3 w-full rounded-md border" style={{ borderColor: c.line }}>
          <span className="float-right m-[2px] block h-[6px] w-[6px] rounded-full" style={{ background: c.accent }} />
        </span>
      </div>
    </div>
  )
}

const MODES: { value: ThemeChoice; label: string }[] = [
  { value: 'light', label: '浅色' },
  { value: 'system', label: '跟随系统' },
  { value: 'dark', label: '深色' },
]

function ThemeCard({ value, label, on, onSelect }: { value: ThemeChoice; label: string; on: boolean; onSelect: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onSelect} className="group flex flex-col items-center gap-2 p-0 text-ink">
      <span
        className={`relative block aspect-[16/10] w-full overflow-hidden rounded-xl border ${
          on ? 'border-primary ring-2 ring-primary' : 'border-line-strong group-hover:border-[color-mix(in_srgb,var(--primary)_50%,transparent)]'
        }`}
      >
        {value === 'system' ? (
          <>
            <span className="absolute inset-0">
              <MiniWindow mode="light" />
            </span>
            <span className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]">
              <MiniWindow mode="dark" />
            </span>
          </>
        ) : (
          <MiniWindow mode={value} />
        )}
      </span>
      <span className={`text-[13px] ${on ? 'font-semibold' : 'text-ink-muted'}`}>{label}</span>
    </button>
  )
}

/** 通用: the active profile's name and avatar (claude.ai's 个人资料), and color mode. */
export function GeneralSettings() {
  const profile = useActiveProfile()
  const { rename, recolor } = useProfiles()
  const theme = useTheme()
  const [name, setName] = useState(profile.name)
  useEffect(() => setName(profile.name), [profile.id, profile.name])

  return (
    <>
      <Section title="个人资料" description="这些信息只保存在这台设备上，用来区分不同的偏好档案。">
        <Row label="档案名称" hint="显示在侧栏左下角和账户菜单里" htmlFor="profile-name" stacked>
          <div className="flex items-center gap-3">
            <Avatar profile={profile} size={36} />
            <input
              id="profile-name"
              value={name}
              maxLength={12}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => (name.trim() ? rename(profile.id, name) : setName(profile.name))}
              onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
              className={`${FIELD} w-full max-w-[320px]`}
            />
          </div>
        </Row>
        <Row label="头像颜色" stacked>
          <div role="radiogroup" aria-label="头像颜色" className="flex flex-wrap gap-2.5">
            {AVATAR_COLORS.map((c) => {
              const on = profile.color === c
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={c}
                  onClick={() => recolor(profile.id, c)}
                  className={`h-7 w-7 rounded-full p-0 ${on ? 'ring-2 ring-primary ring-offset-2 ring-offset-[var(--background)]' : ''}`}
                  style={{ background: c }}
                />
              )
            })}
          </div>
        </Row>
      </Section>
      <Section title="外观">
        <Row label="颜色模式" stacked>
          <div role="radiogroup" aria-label="颜色模式" className="grid max-w-[480px] grid-cols-3 gap-3 sm:gap-4">
            {MODES.map((m) => (
              <ThemeCard key={m.value} value={m.value} label={m.label} on={theme.choice === m.value} onSelect={() => theme.set(m.value)} />
            ))}
          </div>
        </Row>
      </Section>
    </>
  )
}
