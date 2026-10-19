import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { historyGroup } from '../../lib/format'
import { useConversations, type Conversation } from '../../stores/conversations'
import { IconCompose, IconSearch } from '../Icons'
import { AccountButton } from './AccountButton'
import { ClearHistoryDialog } from './ClearHistoryDialog'
import { HistoryItem } from './HistoryItem'

const GROUPS = ['今天', '昨天', '更早'] as const

export function Sidebar() {
  const navigate = useNavigate()
  const conversations = useConversations((s) => s.conversations)
  const [query, setQuery] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)
  const search = useRef<HTMLInputElement>(null)
  const total = useConversations((s) => Object.values(s.conversations).filter((c) => c.messages.length).length)

  // ⌘K / Ctrl+K focuses history search, as the hint in the box says.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        search.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = Object.values(conversations)
      .filter((c) => c.messages.length > 0)
      .filter((c) => !q || c.title.toLowerCase().includes(q) || c.messages.some((m) => `${m.text} ${m.composer?.opening ?? ''}`.toLowerCase().includes(q)))
      .sort((a, b) => b.updatedAt - a.updatedAt)
    const out = new Map<string, Conversation[]>()
    for (const c of list) {
      const g = historyGroup(c.updatedAt)
      out.set(g, [...(out.get(g) ?? []), c])
    }
    return out
  }, [conversations, query])

  return (
    <aside className="flex w-[260px] shrink-0 flex-col gap-3.5 border-r border-line bg-sidebar px-3.5 pb-3.5 pt-5">
      <Link to="/" className="px-1.5 text-ink no-underline hover:text-ink">
        <div className="font-logo text-2xl tracking-[0.3px]">CartPilot</div>
        <div className="text-xs font-medium text-ink-subtle">购物导购</div>
      </Link>
      <button
        type="button"
        onClick={() => navigate('/')}
        className="flex h-10 items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-primary bg-primary-soft text-sm font-semibold text-primary-text"
      >
        <IconCompose />
        新对话
      </button>
      <label className="flex h-[34px] items-center gap-2 rounded-[10px] bg-overlay px-2.5 text-[13px] text-ink-subtle">
        <IconSearch />
        <span className="sr-only-label">搜索历史对话</span>
        <input
          id="history-search"
          ref={search}
          type="search"
          onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索历史对话"
          className="min-w-0 grow bg-transparent text-ink outline-none placeholder:text-ink-subtle"
        />
        <kbd className="rounded-[5px] border border-[rgba(43,37,32,0.14)] px-1.5 py-px font-sans text-[11px]">⌘K</kbd>
      </label>
      <nav aria-label="历史对话" className="-mx-1 flex min-h-0 grow flex-col gap-0.5 overflow-y-auto px-1 text-sm">
        {grouped.size === 0 && (
          <p className="px-2 py-3 text-xs leading-[18px] text-ink-subtle">
            {query ? '没有找到相关对话' : '还没有历史对话。新对话会自动保存在这台设备上。'}
          </p>
        )}
        {GROUPS.filter((g) => grouped.has(g)).map((g, i) => (
          <div key={g} className="flex flex-col gap-0.5">
            <div className={`px-2 pb-1 text-xs text-ink-subtle ${i === 0 ? 'pt-2' : 'pt-3'}`}>{g}</div>
            {grouped.get(g)!.map((c) => (
              <HistoryItem key={c.id} conv={c} />
            ))}
          </div>
        ))}
        {total > 0 && !query && (
          <button type="button" onClick={() => setConfirmClear(true)} className="mt-2 self-start px-2 py-1 text-xs text-ink-subtle hover:text-error-text">
            清空全部历史
          </button>
        )}
      </nav>
      <AccountButton />
      {confirmClear && <ClearHistoryDialog onClose={() => setConfirmClear(false)} />}
    </aside>
  )
}
