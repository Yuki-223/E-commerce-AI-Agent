import { useNavigate } from 'react-router-dom'
import { useConversations } from '../../stores/conversations'

/** WebStates ⑥ 清空全部历史对话 confirmation. */
export function ClearHistoryDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const count = useConversations((s) => Object.values(s.conversations).filter((c) => c.messages.length).length)
  const clear = useConversations((s) => s.clear)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,16,12,0.4)]" onMouseDown={onClose}>
      <div
        role="alertdialog"
        aria-label="确认清空"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        className="flex w-[320px] flex-col gap-2.5 rounded-[14px] border border-line-strong bg-surface p-3.5 shadow-[0_10px_24px_rgba(43,30,18,0.12)]"
      >
        <span className="text-sm font-semibold">清空全部历史对话？</span>
        <span className="text-xs text-ink-muted">此操作不能撤销。</span>
        <div className="flex gap-2">
          <button type="button" autoFocus onClick={onClose} className="h-[34px] grow rounded-[10px] border border-line-strong bg-surface text-[13px] text-ink">
            取消
          </button>
          <button
            type="button"
            disabled={count === 0}
            onClick={() => {
              clear()
              onClose()
              navigate('/')
            }}
            className="h-[34px] grow-[2] rounded-[10px] bg-error-text text-[13px] font-semibold text-on-primary disabled:opacity-50"
          >
            清空全部 {count} 段对话
          </button>
        </div>
      </div>
    </div>
  )
}
