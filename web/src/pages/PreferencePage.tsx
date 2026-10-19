import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { api } from '../api/endpoints'
import type { UserPreference } from '../api/types'
import { IconCheckCircle, IconClose, IconPencil, IconPlus } from '../components/Icons'
import { Avatar } from '../components/layout/AccountButton'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { preferenceKey, preferenceSummary, usePreference } from '../hooks/usePreference'
import { DEFAULT_PROFILE, profileLabel, useActiveProfile, useProfiles, type Profile } from '../stores/profiles'

/** The same option sets as PreferenceView.swift. */
const CATEGORIES = ['美妆护肤', '数码电子', '服饰运动', '食品生活']
const KEYWORDS = ['轻量', '通勤', '高性价比', '品质优先', '便携', '送礼', '环保', '耐用']
const TIERS: [string, string][] = [['value', '省心价'], ['balanced', '均衡'], ['premium', '品质']]

type Sync = 'synced' | 'saving' | 'error'

function Card({ title, children, htmlFor }: { title: string; children: ReactNode; htmlFor?: string }) {
  return (
    <section className="flex flex-col gap-3.5 rounded-[18px] border border-line bg-surface p-5 shadow-[0_2px_6px_rgba(43,30,18,0.04)]">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="text-base font-semibold">
          {title}
        </label>
      ) : (
        <h2 className="m-0 text-base font-semibold">{title}</h2>
      )}
      {children}
    </section>
  )
}

const FIELD = 'h-10 rounded-[10px] border border-[rgba(43,37,32,0.16)] bg-surface px-3 text-[15px] text-ink outline-none focus:border-primary'

function ProfileChip({ profile, active, onSelect }: { profile: Profile; active: boolean; onSelect: () => void }) {
  const { data } = usePreference(profile.userId)
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={`flex h-12 items-center gap-2.5 rounded-[14px] pl-2 pr-3.5 text-left text-ink ${active ? 'border-[1.5px] border-primary bg-primary-soft' : 'border border-line-strong bg-surface'}`}
    >
      <Avatar profile={profile} />
      <span className="flex flex-col">
        <span className="text-sm font-semibold">{profileLabel(profile)}</span>
        <span className="max-w-[160px] truncate text-xs text-ink-muted">{preferenceSummary(data)}</span>
      </span>
    </button>
  )
}

function BrandField({ id, label, values, onAdd, onRemove }: { id: string; label: string; values: string[]; onAdd: (v: string) => void; onRemove: (v: string) => void }) {
  const [draft, setDraft] = useState('')
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] text-ink-muted">
        {label}
      </label>
      <input
        id={id}
        value={draft}
        placeholder="输入品牌后回车"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing && draft.trim()) {
            onAdd(draft.trim())
            setDraft('')
          }
        }}
        className={`${FIELD} h-9 text-sm`}
      />
      {values.length ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <button key={v} type="button" aria-label={`移除 ${v}`} onClick={() => onRemove(v)} className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1.5 text-[13px] text-ink">
              {v}
              <IconClose size={9} strokeWidth={2} />
            </button>
          ))}
        </div>
      ) : (
        <span className="text-xs text-ink-subtle">暂无</span>
      )}
    </div>
  )
}

function KeywordChip({ value, onRename, onRemove }: { value: string; onRename: (v: string) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  if (editing) {
    return (
      <input
        autoFocus
        aria-label={`编辑 ${value}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          onRename(draft)
          setEditing(false)
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
        className="h-9 w-[130px] rounded-full border-[1.5px] border-primary bg-surface px-3.5 text-sm outline-none"
      />
    )
  }
  return (
    <span className="flex items-center gap-2 rounded-full border border-[rgba(206,135,99,0.35)] bg-primary-soft py-[7px] pl-3.5 pr-2 text-sm font-semibold">
      {value}
      <button type="button" aria-label={`编辑 ${value}`} onClick={() => (setDraft(value), setEditing(true))} className="flex h-[22px] w-[22px] items-center justify-center rounded-full p-0 text-primary-text">
        <IconPencil size={12} />
      </button>
      <button type="button" aria-label={`删除 ${value}`} onClick={onRemove} className="flex h-[22px] w-[22px] items-center justify-center rounded-full p-0 text-ink-subtle">
        <IconClose size={10} strokeWidth={2} />
      </button>
    </span>
  )
}

/** Numeric budget input that only commits on blur/Enter, so typing is not interrupted by autosave. */
function BudgetInput({ label, value, onCommit }: { label: string; value: number | null; onCommit: (n: number | null) => void }) {
  const [draft, setDraft] = useState(value == null ? '' : String(value))
  useEffect(() => setDraft(value == null ? '' : String(value)), [value])
  const commit = () => {
    const n = draft.trim() === '' ? null : Number(draft)
    if (n !== null && !Number.isFinite(n)) return setDraft(value == null ? '' : String(value))
    if (n !== value) onCommit(n)
  }
  return (
    <label className="flex flex-col gap-1.5 text-[13px] text-ink-muted">
      {label}
      <input inputMode="decimal" placeholder="不限" value={draft} onChange={(e) => setDraft(e.target.value.replace(/[^\d.]/g, ''))} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} className={FIELD} />
    </label>
  )
}

/** ⑲ WebPreference: the active profile's preferences, saved with PUT /preferences/{user_id}. */
export function PreferencePage() {
  useDocumentTitle('个人偏好')
  const qc = useQueryClient()
  const profile = useActiveProfile()
  const { profiles, setActive, create, rename, remove } = useProfiles()
  const { data: remote, isError: loadError } = usePreference(profile.userId)
  const [pref, setPref] = useState<UserPreference | null>(null)
  const [sync, setSync] = useState<Sync>('synced')
  const [notes, setNotes] = useState('')
  const [newKeyword, setNewKeyword] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Adopt the server copy when switching profiles or when chat remembered something.
  useEffect(() => {
    if (remote && sync !== 'saving') {
      setPref(remote)
      setNotes(remote.preference_note ?? remote.notes ?? '')
    }
  }, [remote, profile.userId])

  const save = (next: UserPreference) => {
    setPref(next)
    setSync('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    const userId = next.user_id
    saveTimer.current = setTimeout(async () => {
      try {
        const { user_id: _id, ...body } = next
        void _id
        const saved = await api.putPreference(userId, body)
        qc.setQueryData(preferenceKey(userId), saved)
        setSync('synced')
      } catch {
        setSync('error')
      }
    }, 900)
  }

  const mutate = (edit: (p: UserPreference) => UserPreference) => pref && save(edit(pref))
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const addUnique = (list: string[], v: string) => (list.includes(v) ? list : [...list, v])

  const status =
    loadError || sync === 'error'
      ? { text: '偏好未同步', cls: 'text-error-text' }
      : sync === 'saving'
        ? { text: '正在保存…', cls: 'text-ink-subtle' }
        : { text: '偏好已同步', cls: 'text-success-text' }

  return (
    <div className="flex min-h-0 grow flex-col gap-4 overflow-y-auto px-10 py-[22px]">
      <div className="flex items-end gap-4">
        <div className="flex grow flex-col gap-1">
          <h1 className="m-0 text-[26px] font-bold">个人偏好</h1>
          <p className="m-0 text-sm text-ink-muted">推荐时会用当前档案的偏好。对话里被记住的偏好也会存进当前档案；购物车和历史对话所有档案共用。</p>
        </div>
        <span role="status" className={`flex items-center gap-1.5 text-[13px] ${status.cls}`}>
          {status.text === '偏好已同步' && <IconCheckCircle size={14} />}
          {status.text}
        </span>
      </div>

      <section aria-label="偏好档案" className="flex flex-wrap items-center gap-2.5 rounded-[18px] border border-line bg-surface px-3.5 py-2.5 shadow-[0_2px_6px_rgba(43,30,18,0.04)]">
        <span className="pr-1 text-[13px] font-semibold text-ink-muted">偏好档案</span>
        <div role="radiogroup" aria-label="选择偏好档案" className="flex flex-wrap gap-2">
          {profiles.map((p) => (
            <ProfileChip key={p.id} profile={p} active={p.id === profile.id} onSelect={() => setActive(p.id)} />
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            const name = window.prompt('新档案名称，例如「给妈妈买」')
            if (name?.trim()) create(name)
          }}
          className="flex h-12 items-center gap-1.5 rounded-[14px] border-[1.5px] border-dashed border-[rgba(184,112,77,0.5)] px-3.5 text-sm font-semibold text-primary-text"
        >
          <IconPlus size={14} strokeWidth={2.4} />
          新建档案
        </button>
        <span className="grow" />
        {renaming ? (
          <input
            autoFocus
            aria-label="档案名称"
            value={nameDraft}
            maxLength={12}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => (rename(profile.id, nameDraft), setRenaming(false))}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            className="h-[34px] w-32 rounded-[10px] border-[1.5px] border-primary bg-surface px-2.5 text-[13px] outline-none"
          />
        ) : (
          <button type="button" onClick={() => (setNameDraft(profile.name), setRenaming(true))} className="h-[34px] rounded-[10px] bg-secondary px-3 text-[13px] text-ink">
            重命名
          </button>
        )}
        <button
          type="button"
          disabled={profile.id === DEFAULT_PROFILE.id}
          title={profile.id === DEFAULT_PROFILE.id ? '默认档案不能删除' : undefined}
          onClick={() => window.confirm(`删除档案「${profile.name}」？本机不再显示它的偏好。`) && remove(profile.id)}
          className="h-[34px] rounded-[10px] px-3 text-[13px] text-error-text disabled:opacity-40"
        >
          删除档案
        </button>
        <span aria-hidden="true" className="mx-1 h-7 w-px bg-line-strong" />
        <span className="text-[13px]">个性化推荐</span>
        <button
          type="button"
          role="switch"
          aria-checked={pref?.personalization_enabled ?? true}
          aria-label="个性化推荐"
          onClick={() => mutate((p) => ({ ...p, personalization_enabled: !p.personalization_enabled }))}
          className={`flex h-[31px] w-[51px] rounded-2xl p-0.5 transition-colors ${pref?.personalization_enabled ?? true ? 'justify-end bg-primary' : 'justify-start bg-disabled'}`}
        >
          <span className="h-[27px] w-[27px] rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)]" />
        </button>
      </section>

      {!pref ? (
        <div className="p-6 text-sm text-ink-muted">{loadError ? '偏好暂时无法同步，请确认后端已启动。' : '正在读取偏好…'}</div>
      ) : (
        <div className={`grid grid-cols-1 items-start gap-5 min-[1100px]:grid-cols-2 ${pref.personalization_enabled ? '' : 'opacity-60'}`}>
          <div className="flex flex-col gap-5">
            <Card title="预算与价格">
              <div className="grid grid-cols-2 gap-3">
                <BudgetInput label="最低（元）" value={pref.budget_min} onCommit={(n) => mutate((p) => ({ ...p, budget_min: n }))} />
                <BudgetInput label="最高（元）" value={pref.budget_max} onCommit={(n) => mutate((p) => ({ ...p, budget_max: n }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] text-ink-muted">价格倾向</span>
                <div role="radiogroup" aria-label="价格倾向" className="grid grid-cols-3 rounded-xl bg-[var(--segment)] p-[3px]">
                  {TIERS.map(([value, label]) => {
                    const on = (pref.price_tier ?? 'balanced') === value
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => mutate((p) => ({ ...p, price_tier: value }))}
                        className={`h-[34px] rounded-[9px] text-sm text-ink ${on ? 'bg-surface font-semibold shadow-[0_2px_6px_rgba(0,0,0,0.08)]' : ''}`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </Card>
            <Card title="关注品类">
              <div className="grid grid-cols-4 gap-2.5">
                {CATEGORIES.map((c) => {
                  const on = pref.favorite_categories.includes(c)
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={on}
                      onClick={() => mutate((p) => ({ ...p, favorite_categories: toggle(p.favorite_categories, c) }))}
                      className={`h-10 rounded-full text-sm font-medium ${on ? 'bg-primary text-white' : 'bg-secondary text-ink'}`}
                    >
                      {c}
                    </button>
                  )
                })}
              </div>
            </Card>
          </div>
          <div className="flex flex-col gap-5">
            <Card title="品牌偏好">
              <div className="grid grid-cols-2 gap-4">
                <BrandField
                  id="brand-include"
                  label="喜欢品牌"
                  values={pref.brand_include}
                  onAdd={(v) => mutate((p) => ({ ...p, brand_include: addUnique(p.brand_include, v) }))}
                  onRemove={(v) => mutate((p) => ({ ...p, brand_include: p.brand_include.filter((x) => x !== v) }))}
                />
                <BrandField
                  id="brand-exclude"
                  label="避免品牌"
                  values={pref.brand_exclude}
                  onAdd={(v) => mutate((p) => ({ ...p, brand_exclude: addUnique(p.brand_exclude, v) }))}
                  onRemove={(v) => mutate((p) => ({ ...p, brand_exclude: p.brand_exclude.filter((x) => x !== v) }))}
                />
              </div>
            </Card>
            <Card title="购物风格">
              <div className="flex flex-wrap gap-2">
                {pref.preference_keywords.map((k) => (
                  <KeywordChip
                    key={k}
                    value={k}
                    onRemove={() => mutate((p) => ({ ...p, preference_keywords: p.preference_keywords.filter((x) => x !== k) }))}
                    onRename={(v) =>
                      mutate((p) => {
                        const rest = p.preference_keywords.filter((x) => x !== k)
                        return { ...p, preference_keywords: v.trim() && !rest.includes(v.trim()) ? [...rest, v.trim()] : rest }
                      })
                    }
                  />
                ))}
                <label htmlFor="keyword-new" className="sr-only-label">
                  新增关键词
                </label>
                <input
                  id="keyword-new"
                  value={newKeyword}
                  placeholder="+ 新增关键词"
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing && newKeyword.trim()) {
                      mutate((p) => ({ ...p, preference_keywords: addUnique(p.preference_keywords, newKeyword.trim()) }))
                      setNewKeyword('')
                    }
                  }}
                  className="h-9 w-[130px] rounded-full border border-dashed border-[rgba(43,37,32,0.24)] bg-transparent px-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs text-ink-muted">推荐关键词（点一下添加）</span>
                <div className="flex flex-wrap gap-2">
                  {KEYWORDS.filter((k) => !pref.preference_keywords.includes(k)).map((k) => (
                    <button key={k} type="button" onClick={() => mutate((p) => ({ ...p, preference_keywords: addUnique(p.preference_keywords, k) }))} className="rounded-full bg-secondary px-3.5 py-[7px] text-[13px] text-ink">
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
            <Card title="补充偏好" htmlFor="pref-notes">
              <textarea
                id="pref-notes"
                value={notes}
                placeholder="例如：敏感肌，护肤品尽量不要含酒精和香精。"
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => {
                  const clean = notes.trim()
                  if (clean === (pref.preference_note ?? '').trim()) return
                  mutate((p) => ({ ...p, preference_note: clean ? notes : null, notes: clean ? notes : null }))
                }}
                className="min-h-[44px] resize-y rounded-[10px] border border-[rgba(43,37,32,0.16)] bg-surface px-3 py-2.5 text-sm leading-[21px] text-ink outline-none focus:border-primary"
              />
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
