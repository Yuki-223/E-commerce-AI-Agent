import { useState } from 'react'
import { IconPlus } from '../../components/Icons'
import { Avatar } from '../../components/layout/AccountButton'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { preferenceSummary, usePreference } from '../../hooks/usePreference'
import { DEFAULT_PROFILE, profileLabel, useProfiles, type Profile } from '../../stores/profiles'
import { BUTTON, BUTTON_DANGER, BUTTON_PRIMARY, FIELD, Section } from './ui'

function ProfileRow({ profile, active }: { profile: Profile; active: boolean }) {
  const { setActive, rename, remove } = useProfiles()
  const { data } = usePreference(profile.userId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(profile.name)
  const isDefault = profile.id === DEFAULT_PROFILE.id

  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-line-faint py-3.5 last:border-b-0 sm:flex-nowrap">
      <Avatar profile={profile} size={36} />
      <div className="flex min-w-0 grow flex-col gap-0.5">
        {editing ? (
          <input
            autoFocus
            aria-label="档案名称"
            value={draft}
            maxLength={12}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => (rename(profile.id, draft), setEditing(false))}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            className={`${FIELD} h-8 w-40`}
          />
        ) : (
          <span className="flex items-center gap-2 text-[15px] font-medium">
            {profileLabel(profile)}
            {active && <span className="rounded-md bg-primary-soft px-1.5 py-px text-[11px] font-semibold text-primary-text">当前使用</span>}
          </span>
        )}
        <span className="truncate text-[13px] text-ink-muted">{preferenceSummary(data) || ' '}</span>
      </div>
      <div className="flex gap-2">
        {!active && (
          <button type="button" onClick={() => setActive(profile.id)} className={BUTTON}>
            切换到此档案
          </button>
        )}
        <button type="button" onClick={() => (setDraft(profile.name), setEditing(true))} className={BUTTON}>
          重命名
        </button>
        {!isDefault && (
          <button
            type="button"
            onClick={() => window.confirm(`删除档案「${profile.name}」？本机不再显示它的偏好。`) && remove(profile.id)}
            className={BUTTON_DANGER}
          >
            删除
          </button>
        )}
      </div>
    </li>
  )
}

/** 偏好档案: one row per profile; each profile is its own backend user_id. */
export function ProfileSettings() {
  useDocumentTitle('偏好档案')
  const { profiles, activeId, create } = useProfiles()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const submit = () => {
    if (name.trim()) create(name)
    setName('')
    setAdding(false)
  }

  return (
    <Section
      title="偏好档案"
      description="给家人或不同场景各建一个档案，推荐时只用当前档案的偏好。购物车和历史对话所有档案共用。"
      action={
        !adding && (
          <button type="button" onClick={() => setAdding(true)} className={BUTTON}>
            <IconPlus size={12} strokeWidth={2.4} />
            新建档案
          </button>
        )
      }
    >
      <ul className="m-0 flex list-none flex-col p-0">
        {profiles.map((p) => (
          <ProfileRow key={p.id} profile={p} active={p.id === activeId} />
        ))}
      </ul>
      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <label htmlFor="new-profile" className="sr-only-label">
            新档案名称
          </label>
          <input
            id="new-profile"
            autoFocus
            value={name}
            maxLength={12}
            placeholder="例如「给妈妈买」"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setAdding(false)}
            className={`${FIELD} w-56`}
          />
          <button type="submit" disabled={!name.trim()} className={BUTTON_PRIMARY}>
            创建
          </button>
          <button type="button" onClick={() => (setName(''), setAdding(false))} className={BUTTON}>
            取消
          </button>
        </form>
      )}
    </Section>
  )
}
