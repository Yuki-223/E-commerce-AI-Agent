import { useMemo, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { historyGroup, historyTime } from '../../lib/format'
import { productCount, useConversations, type Conversation } from '../../stores/conversations'
import { IconCompose, IconSearch } from '../Icons'
import { AccountButton } from './AccountButton'

const GROUPS = ['今天', '昨天', '更早'] as const

export function Sidebar() {
  const navigate = useNavigate()
  const conversations = useConversations((s) => s.conversations)
  const [query, setQuery] = useState('')

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = Object.values(conversations)
      .filter((c) => c.messages.length > 0)
      .filter((c) => !q || c.title.toLowerCase().includes(q) || c.messages.some((m) => m.text.toLowerCase().includes(q)))
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
              <NavLink
                key={c.id}
                to={`/c/${c.id}`}
                className={({ isActive }) =>
                  `flex flex-col gap-0.5 rounded-[10px] px-2.5 py-[9px] text-ink no-underline hover:bg-overlay hover:text-ink ${
                    isActive ? 'bg-surface shadow-[0_1px_3px_rgba(43,30,18,0.06)]' : ''
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`truncate ${isActive ? 'font-semibold' : ''}`}>{c.title}</span>
                    <span className="text-xs text-ink-subtle">
                      {historyTime(c.updatedAt)}
                      {productCount(c) > 0 && ` · ${productCount(c)} 个商品`}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <AccountButton />
    </aside>
  )
}
