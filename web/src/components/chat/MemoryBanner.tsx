import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api/endpoints'
import type { UserPreference } from '../../api/types'
import { preferenceKey } from '../../hooks/usePreference'
import { useConversations, type ChatMessage } from '../../stores/conversations'
import { IconCheckCircle, IconClose, IconUndo } from '../Icons'

/**
 * WebInChat ⑰ 偏好已记住条 and WebStates ⑧ 撤销后. Shows the newest memory_update
 * of the conversation; 撤销 calls POST /preferences/{user_id}/undo for each token.
 */
export function MemoryBanner({ convId, message }: { convId: string; message: ChatMessage }) {
  const qc = useQueryClient()
  const patchMessage = useConversations((s) => s.patchMessage)
  const [busy, setBusy] = useState(false)
  const notices = message.memory ?? []
  if (!notices.length || notices.every((n) => n.dismissed)) return null

  const userId = message.request?.user_id ?? ''
  const undone = notices.every((n) => n.undone)
  const failed = notices.some((n) => n.undoError)
  const update = (patch: (n: (typeof notices)[number]) => Partial<(typeof notices)[number]>) =>
    patchMessage(convId, message.id, (m) => ({ memory: (m.memory ?? []).map((n) => ({ ...n, ...patch(n) })) }))

  const undo = async () => {
    setBusy(true)
    let ok = true
    // Undo newest first so each restores the snapshot taken before it.
    for (const n of [...notices].reverse()) {
      if (n.undone) continue
      try {
        const res = await api.undoPreference(userId, n.undo_token)
        qc.setQueryData<UserPreference>(preferenceKey(userId), res.preference)
      } catch {
        ok = false
      }
    }
    update(() => (ok ? { undone: true, undoError: false } : { undoError: true }))
    setBusy(false)
  }

  const box = 'mx-auto mt-3 flex w-[calc(100%-64px)] max-w-[820px] shrink-0 items-center gap-2.5 rounded-[14px] border bg-surface px-3.5 py-2.5 shadow-[0_2px_8px_rgba(43,30,18,0.05)]'

  if (undone) {
    return (
      <div role="status" className={`${box} border-line-strong`}>
        <IconUndo className="shrink-0 text-ink-muted" />
        <span className="grow text-[13px]">已撤销刚才记住的偏好</span>
        <button type="button" aria-label="关闭提示" onClick={() => update(() => ({ dismissed: true }))} className="flex h-7 w-7 items-center justify-center p-0 text-ink-subtle">
          <IconClose />
        </button>
      </div>
    )
  }

  return (
    <div role="status" className={`${box} border-[rgba(206,135,99,0.45)]`}>
      <IconCheckCircle size={18} tone="var(--primary)" className="shrink-0" />
      <span className="grow text-[13px] font-medium">
        {notices.map((n) => n.message).join('；')} <span className="font-normal text-ink-subtle">· 以后推荐会自动参考</span>
        {failed && <span className="ml-2 font-normal text-error-text">撤销失败</span>}
      </span>
      <button type="button" disabled={busy} onClick={() => void undo()} className="h-[30px] rounded-full bg-soft-purple px-3 text-[13px] font-semibold text-primary-text disabled:opacity-60">
        {busy ? '撤销中…' : failed ? '重试撤销' : '撤销'}
      </button>
      <Link to="/settings/preferences" className="text-[13px] text-ink-muted no-underline">
        管理偏好
      </Link>
      <button type="button" aria-label="关闭提示" onClick={() => update(() => ({ dismissed: true }))} className="flex h-7 w-7 items-center justify-center p-0 text-ink-subtle">
        <IconClose />
      </button>
    </div>
  )
}
