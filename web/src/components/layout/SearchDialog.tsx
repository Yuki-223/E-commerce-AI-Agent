import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { historyGroup, historyTime } from '../../lib/format'
import { useConversations, type Conversation } from '../../stores/conversations'
import { IconClose, IconHistory, IconSearch } from '../Icons'

interface Hit {
  conv: Conversation
  /** Message text around the match, when the title itself did not match. */
  snippet?: string
}

function snippetAround(text: string, q: string): string {
  const i = text.toLowerCase().indexOf(q)
  const start = Math.max(0, i - 12)
  return `${start > 0 ? '…' : ''}${text.slice(start, start + 48).replace(/\s+/g, ' ')}`
}

function search(conversations: Record<string, Conversation>, raw: string): Hit[] {
  const q = raw.trim().toLowerCase()
  const hits: Hit[] = []
  const list = Object.values(conversations)
    .filter((c) => c.messages.length > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt)
  for (const conv of list) {
    if (!q || conv.title.toLowerCase().includes(q)) {
      hits.push({ conv })
      continue
    }
    const text = conv.messages.map((m) => `${m.text} ${m.composer?.opening ?? ''}`).find((t) => t.toLowerCase().includes(q))
    if (text) hits.push({ conv, snippet: snippetAround(text, q) })
  }
  return hits
}

/**
 * claude.ai-style search window over the history (⌘K or 搜索 in the sidebar):
 * input on top, results below, ↑↓ to move, Enter to open, Esc to close.
 */
export function SearchDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const conversations = useConversations((s) => s.conversations)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const hits = useMemo(() => search(conversations, query), [conversations, query])

  useEffect(() => setCursor(0), [query])
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${cursor}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const open = (conv: Conversation) => {
    onClose()
    navigate(`/c/${conv.id}`)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(c + 1, hits.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    } else if (e.key === 'Enter' && hits[cursor]) {
      e.preventDefault()
      open(hits[cursor].conv)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-center bg-[rgba(20,16,12,0.4)] px-4 pt-[12vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="搜索历史对话"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        className="flex h-fit max-h-[min(560px,76vh)] w-[600px] max-w-full flex-col overflow-hidden rounded-[18px] border border-line-strong bg-surface shadow-pop"
      >
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line-faint px-4">
          <IconSearch size={17} className="shrink-0 text-ink-muted" />
          <input
            autoFocus
            type="text"
            aria-label="搜索历史对话"
            role="combobox"
            aria-expanded="true"
            aria-controls="search-results"
            aria-activedescendant={hits[cursor] ? `search-hit-${cursor}` : undefined}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索历史对话…"
            className="min-w-0 grow bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-subtle focus-visible:outline-none"
          />
          <button type="button" aria-label="关闭" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full p-0 text-ink-muted hover:bg-secondary">
            <IconClose />
          </button>
        </div>

        <div ref={listRef} id="search-results" role="listbox" aria-label="搜索结果" className="min-h-0 overflow-y-auto p-2">
          {hits.length === 0 ? (
            <p className="m-0 px-3 py-8 text-center text-sm text-ink-subtle">{query.trim() ? '没有找到相关对话' : '还没有历史对话'}</p>
          ) : (
            <>
              {!query.trim() && <div className="px-3 pb-1 pt-1.5 text-xs font-medium text-ink-subtle">最近</div>}
              {hits.map((h, i) => (
                <div
                  key={h.conv.id}
                  id={`search-hit-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={i === cursor}
                  onMouseMove={() => setCursor(i)}
                  onClick={() => open(h.conv)}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ${i === cursor ? 'bg-secondary' : ''}`}
                >
                  <IconHistory size={16} className="shrink-0 text-ink-subtle" />
                  <span className="flex min-w-0 grow flex-col">
                    <span className="truncate text-sm text-ink">{h.conv.title}</span>
                    {h.snippet && <span className="truncate text-xs text-ink-subtle">{h.snippet}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-ink-subtle">
                    {historyGroup(h.conv.updatedAt) === '昨天' ? '昨天' : historyTime(h.conv.updatedAt)}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-4 border-t border-line-faint px-4 py-2 text-xs text-ink-subtle">
          <span>
            <kbd className="font-sans">↑↓</kbd> 选择
          </span>
          <span>
            <kbd className="font-sans">Enter</kbd> 打开
          </span>
          <span>
            <kbd className="font-sans">Esc</kbd> 关闭
          </span>
        </div>
      </div>
    </div>
  )
}
