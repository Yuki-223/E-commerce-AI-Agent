import { useEffect, useRef, useState } from 'react'
import { NavLink, useMatch, useNavigate } from 'react-router-dom'
import { historyTime } from '../../lib/format'
import { productCount, useConversations, type Conversation } from '../../stores/conversations'
import { IconMore, IconPencil, IconTrash } from '../Icons'

/**
 * One history row with the WebStates ⑥ ⋯ menu (重命名 / 删除对话).
 * `dense` is the desktop sidebar's single-line row; the phone drawer keeps
 * the two-line card with time and product count.
 */
export function HistoryItem({ conv, dense = false }: { conv: Conversation; dense?: boolean }) {
  const navigate = useNavigate()
  const active = useMatch(`/c/${conv.id}`)
  const { rename, remove } = useConversations()
  const [menu, setMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(conv.title)
  const wrap = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setMenu(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menu])

  useEffect(() => {
    if (editing) input.current?.select()
  }, [editing])

  const commit = () => {
    if (draft.trim() && draft.trim() !== conv.title) rename(conv.id, draft)
    setEditing(false)
  }

  if (editing) {
    return (
      <label className="flex flex-col gap-1 px-1 py-1">
        <span className="sr-only-label">重命名对话</span>
        <input
          ref={input}
          value={draft}
          maxLength={40}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') {
              setDraft(conv.title)
              setEditing(false)
            }
          }}
          className="h-[34px] rounded-[10px] border-[1.5px] border-primary bg-surface px-2.5 text-sm text-ink outline-none"
        />
      </label>
    )
  }

  const meta = `${historyTime(conv.updatedAt)}${productCount(conv) > 0 ? ` · ${productCount(conv)} 个商品` : ''}`

  return (
    <div ref={wrap} className="group relative">
      {dense ? (
        <NavLink
          to={`/c/${conv.id}`}
          title={`${conv.title}\n${meta}`}
          className={`flex h-8 items-center rounded-lg pl-2 pr-8 text-[13.5px] no-underline hover:bg-sidebar-hover ${
            active || menu ? 'bg-sidebar-active text-ink hover:bg-sidebar-active hover:text-ink' : 'text-ink-muted hover:text-ink'
          }`}
        >
          <span className="truncate">{conv.title}</span>
        </NavLink>
      ) : (
        <NavLink
          to={`/c/${conv.id}`}
          className={`flex flex-col gap-0.5 rounded-[10px] py-[9px] pl-2.5 pr-9 text-ink no-underline hover:bg-overlay hover:text-ink ${
            active ? 'bg-surface shadow-[0_1px_3px_rgba(43,30,18,0.06)]' : ''
          }`}
        >
          <span className={`truncate ${active ? 'font-semibold' : ''}`}>{conv.title}</span>
          <span className="text-xs text-ink-subtle">{meta}</span>
        </NavLink>
      )}
      <button
        type="button"
        aria-label={`更多操作：${conv.title}`}
        aria-haspopup="menu"
        aria-expanded={menu}
        onClick={() => setMenu((m) => !m)}
        className={`absolute top-1/2 flex -translate-y-1/2 items-center justify-center p-0 text-ink-muted ${
          dense ? 'right-1 h-6 w-6 rounded-md bg-transparent hover:text-ink' : 'right-1.5 h-7 w-7 rounded-lg bg-soft-purple'
        } ${
          menu ? 'opacity-100' : 'opacity-0 focus-visible:opacity-100 group-hover:opacity-100'
        }`}
      >
        <IconMore />
      </button>
      {menu && (
        <div role="menu" className="absolute right-1 top-[calc(100%-4px)] z-30 flex origin-top-right animate-pop-up w-[150px] flex-col rounded-xl border border-line-strong bg-surface p-1.5 shadow-[0_10px_24px_rgba(43,30,18,0.14)]">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(false)
              setDraft(conv.title)
              setEditing(true)
            }}
            className="flex h-8 items-center gap-2 rounded-lg px-2.5 text-left text-[13px] text-ink hover:bg-secondary"
          >
            <IconPencil />
            重命名
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(false)
              remove(conv.id)
              if (active) navigate('/')
            }}
            className="flex h-8 items-center gap-2 rounded-lg px-2.5 text-left text-[13px] text-error-text hover:bg-secondary"
          >
            <IconTrash size={14} />
            删除对话
          </button>
        </div>
      )}
    </div>
  )
}
