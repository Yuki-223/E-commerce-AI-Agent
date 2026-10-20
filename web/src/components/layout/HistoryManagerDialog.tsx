import { useMemo, useState } from 'react'
import { usePresence, usePresenceList, type PresenceProps } from '../../hooks/usePresence'
import { historyTime } from '../../lib/format'
import { productCount, useConversations } from '../../stores/conversations'
import { CollapseBox } from '../Collapse'
import { IconClose, IconPencil, IconTrash } from '../Icons'
import { ClearHistoryDialog } from './ClearHistoryDialog'

/** 管理历史对话 from the account menu: every conversation with rename / delete, plus clear all. */
export function HistoryManagerDialog({ onClose, presence }: { onClose: () => void; presence?: PresenceProps }) {
  const all = useConversations((s) => s.conversations)
  const conversations = useMemo(() => Object.values(all).filter((c) => c.messages.length).sort((a, b) => b.updatedAt - a.updatedAt), [all])
  const { rename, remove } = useConversations()
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [confirm, setConfirm] = useState(false)
  const confirmDialog = usePresence(confirm)
  // A deleted conversation collapses out of the list instead of vanishing.
  const rows = usePresenceList(conversations, (c) => c.id)

  return (
    <div {...presence} className="fixed inset-0 z-50 flex animate-fade-in closing:animate-fade-out items-center justify-center bg-[rgba(20,16,12,0.4)]" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label="管理历史对话" onMouseDown={(e) => e.stopPropagation()} className="flex max-h-[80vh] animate-dialog-in closing-in:animate-dialog-out w-[480px] max-w-[calc(100vw-32px)] flex-col rounded-[18px] border border-line-strong bg-surface shadow-pop">
        <div className="flex items-center border-b border-line-faint px-5 py-4">
          <h2 className="m-0 grow text-base font-semibold">管理历史对话</h2>
          <button type="button" aria-label="关闭" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary p-0 text-ink-muted">
            <IconClose />
          </button>
        </div>
        <div className="flex min-h-0 flex-col gap-1 overflow-y-auto p-3">
          {conversations.length === 0 && <p className="m-0 p-4 text-center text-sm text-ink-subtle">还没有历史对话。</p>}
          {rows.map(({ key, item: c, props }) => (
            <CollapseBox key={key} presence={props} appear={false}>
              {editing === c.id ? (
                <input
                  autoFocus
                  aria-label="重命名对话"
                  value={draft}
                  maxLength={40}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => {
                    rename(c.id, draft)
                    setEditing(null)
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
                  className="h-[42px] w-full rounded-[10px] border-[1.5px] border-primary bg-surface px-3 text-sm outline-none"
                />
              ) : (
                <div className="flex items-center gap-2 rounded-[10px] px-3 py-2 hover:bg-field">
                  <div className="flex min-w-0 grow flex-col">
                    <span className="truncate text-sm font-semibold">{c.title}</span>
                    <span className="text-xs text-ink-subtle">
                      {historyTime(c.updatedAt)}
                      {productCount(c) > 0 && ` · ${productCount(c)} 个商品`}
                    </span>
                  </div>
                  <button type="button" aria-label={`重命名 ${c.title}`} onClick={() => (setEditing(c.id), setDraft(c.title))} className="flex h-8 w-8 items-center justify-center rounded-lg p-0 text-ink-muted hover:bg-secondary">
                    <IconPencil />
                  </button>
                  <button type="button" aria-label={`删除 ${c.title}`} onClick={() => remove(c.id)} className="flex h-8 w-8 items-center justify-center rounded-lg p-0 text-error-text hover:bg-secondary">
                    <IconTrash size={14} />
                  </button>
                </div>
              )}
            </CollapseBox>
          ))}
        </div>
        {conversations.length > 0 && (
          <div className="border-t border-line-faint px-5 py-3">
            <button type="button" onClick={() => setConfirm(true)} className="text-[13px] font-semibold text-error-text">
              清空全部历史对话
            </button>
          </div>
        )}
      </div>
      {confirmDialog.mounted && <ClearHistoryDialog presence={confirmDialog.props} onClose={() => setConfirm(false)} onCleared={onClose} />}
    </div>
  )
}
