import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { api } from '../api/endpoints'
import type { UserPreference } from '../api/types'
import { IconCheckCircle, IconChevronDown, IconClose, IconPencil } from '../components/Icons'
import { Avatar } from '../components/layout/AccountButton'
import { Segmented } from '../components/Segmented'
import { preferenceKey, usePreference } from '../hooks/usePreference'
import { profileLabel, useActiveProfile, useProfiles } from '../stores/profiles'
import { useSettings } from '../stores/ui'
import { FIELD, Row, Section, Switch } from './settings/ui'

/** The same option sets as PreferenceView.swift. */
const CATEGORIES = ['美妆护肤', '数码电子', '服饰运动', '食品生活']
const KEYWORDS = ['轻量', '通勤', '高性价比', '品质优先', '便携', '送礼', '环保', '耐用']
const TIERS: [string, string][] = [['value', '省心价'], ['balanced', '均衡'], ['premium', '品质']]

type Sync = 'synced' | 'saving' | 'error'

function BrandField({ id, label, values, onAdd, onRemove }: { id: string; label: string; values: string[]; onAdd: (v: string) => void; onRemove: (v: string) => void }) {
  const [draft, setDraft] = useState('')
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[15px] font-medium">
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
        className={FIELD}
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
    <input
      inputMode="decimal"
      aria-label={label}
      placeholder="不限"
      value={draft}
      onChange={(e) => setDraft(e.target.value.replace(/[^\d.]/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      className={`${FIELD} w-[96px] text-right`}
    />
  )
}

/** ⑲ WebPreference, as the 购物偏好 settings tab: the active profile's preferences, saved with PUT /preferences/{user_id}. */
export function PreferencePage() {
  const qc = useQueryClient()
  const profile = useActiveProfile()
  const { profiles, setActive } = useProfiles()
  const openSettings = useSettings((s) => s.open)
  const { data: remote, isError: loadError } = usePreference(profile.userId)
  const [pref, setPref] = useState<UserPreference | null>(null)
  const [sync, setSync] = useState<Sync>('synced')
  const [notes, setNotes] = useState('')
  const [newKeyword, setNewKeyword] = useState('')
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

  const statusBadge = (
    <span role="status" className={`flex shrink-0 items-center gap-1.5 pt-1 text-[13px] ${status.cls}`}>
      {status.text === '偏好已同步' && <IconCheckCircle size={14} />}
      {status.text}
    </span>
  )

  return (
    <>
      <Section title="购物偏好" description="推荐商品时会参考当前档案的偏好。对话里被记住的偏好也会出现在这里。" action={statusBadge}>
        <Row label="正在编辑的档案" hint={
            <button type="button" onClick={() => openSettings('profiles')} className="p-0 text-[13px] text-ink-muted underline underline-offset-2">
              管理偏好档案
            </button>
          }>
          <label className="relative flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface pl-1.5 pr-8 text-sm">
            <Avatar profile={profile} size={24} />
            <span className="max-w-[140px] truncate">{profileLabel(profile)}</span>
            <IconChevronDown className="pointer-events-none absolute right-2.5 text-ink-subtle" />
            <select aria-label="选择偏好档案" value={profile.id} onChange={(e) => setActive(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {profileLabel(p)}
                </option>
              ))}
            </select>
          </label>
        </Row>
        <Row label="个性化推荐" hint="关闭后推荐不再参考这里的偏好，也不会从对话里记住新的偏好">
          <Switch
            label="个性化推荐"
            checked={pref?.personalization_enabled ?? true}
            onChange={(on) => mutate((p) => ({ ...p, personalization_enabled: on }))}
          />
        </Row>
      </Section>

      {!pref ? (
        <div className="py-6 text-sm text-ink-muted">{loadError ? '偏好暂时无法同步，请确认后端已启动。' : '正在读取偏好…'}</div>
      ) : (
        <div className={pref.personalization_enabled ? '' : 'opacity-60'}>
          <Section title="预算与价格">
            <Row label="预算范围" hint="单件商品的价格区间，留空表示不限" wide>
              <div className="flex items-center gap-2 text-sm text-ink-muted">
                <span>¥</span>
                <BudgetInput label="最低（元）" value={pref.budget_min} onCommit={(n) => mutate((p) => ({ ...p, budget_min: n }))} />
                <span>–</span>
                <BudgetInput label="最高（元）" value={pref.budget_max} onCommit={(n) => mutate((p) => ({ ...p, budget_max: n }))} />
              </div>
            </Row>
            <Row label="价格倾向" hint="预算内更看重便宜还是品质" wide>
              <Segmented label="价格倾向" options={TIERS} value={pref.price_tier ?? 'balanced'} onChange={(value) => mutate((p) => ({ ...p, price_tier: value }))} />
            </Row>
          </Section>

          <Section title="关注品类" description="首页和推荐会优先展示这些品类。">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const on = pref.favorite_categories.includes(c)
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={on}
                    onClick={() => mutate((p) => ({ ...p, favorite_categories: toggle(p.favorite_categories, c) }))}
                    className={`flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-sm ${
                      on ? 'border-primary bg-primary-soft font-medium text-primary-text' : 'border-line-strong bg-surface text-ink'
                    }`}
                  >
                    {on && <IconCheckCircle size={13} />}
                    {c}
                  </button>
                )
              })}
            </div>
          </Section>

          <Section title="品牌偏好">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <BrandField
                id="brand-include"
                label="喜欢的品牌"
                values={pref.brand_include}
                onAdd={(v) => mutate((p) => ({ ...p, brand_include: addUnique(p.brand_include, v) }))}
                onRemove={(v) => mutate((p) => ({ ...p, brand_include: p.brand_include.filter((x) => x !== v) }))}
              />
              <BrandField
                id="brand-exclude"
                label="想避开的品牌"
                values={pref.brand_exclude}
                onAdd={(v) => mutate((p) => ({ ...p, brand_exclude: addUnique(p.brand_exclude, v) }))}
                onRemove={(v) => mutate((p) => ({ ...p, brand_exclude: p.brand_exclude.filter((x) => x !== v) }))}
              />
            </div>
          </Section>

          <Section title="购物风格" description="描述你买东西时在意什么，推荐理由会围绕这些关键词来写。">
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
                className="h-9 w-[130px] rounded-full border border-dashed border-line-strong bg-transparent px-3 text-sm outline-none focus:border-primary"
              />
            </div>
            {KEYWORDS.some((k) => !pref.preference_keywords.includes(k)) && (
              <div className="flex flex-col gap-2">
                <span className="text-[13px] text-ink-muted">推荐关键词（点一下添加）</span>
                <div className="flex flex-wrap gap-2">
                  {KEYWORDS.filter((k) => !pref.preference_keywords.includes(k)).map((k) => (
                    <button key={k} type="button" onClick={() => mutate((p) => ({ ...p, preference_keywords: addUnique(p.preference_keywords, k) }))} className="rounded-full bg-secondary px-3.5 py-[7px] text-[13px] text-ink">
                      {k}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Section>

          <Section title="补充偏好">
            <Row label="还有什么想让 CartPilot 知道的？" hint="例如肤质、过敏成分、尺码，推荐时会一并考虑" htmlFor="pref-notes" stacked>
              <textarea
                id="pref-notes"
                value={notes}
                rows={4}
                placeholder="例如：敏感肌，护肤品尽量不要含酒精和香精。"
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => {
                  const clean = notes.trim()
                  if (clean === (pref.preference_note ?? '').trim()) return
                  mutate((p) => ({ ...p, preference_note: clean ? notes : null, notes: clean ? notes : null }))
                }}
                className="resize-y rounded-lg border border-line-strong bg-surface px-3 py-2.5 text-sm leading-[21px] text-ink outline-none focus:border-primary"
              />
            </Row>
          </Section>
        </div>
      )}
    </>
  )
}
