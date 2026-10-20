import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { placeOrder, retry } from '../../chat/engine'
import { useProducts } from '../../hooks/useProducts'
import type { ChatMessage, OrderChoice } from '../../stores/conversations'
import { IconAlert, IconRetry } from '../Icons'
import { InlineComparison } from '../compare/InlineComparison'
import { ProductCard } from './ProductCard'
import { SpecSelectionCard } from './SpecSelectionCard'
import { StatusBubble } from './StatusBubble'
import { StreamText } from './StreamText'
import { ThinkingBlock } from './ThinkingBlock'

interface Props {
  convId: string
  message: ChatMessage
  /** Follow-up chips only under the latest answer. */
  isLatest: boolean
  /** Sends a follow-up chip, or a search restated without one condition. */
  onFollowup: (text: string) => void
  /** Cards ticked 加入对比 anywhere in the conversation. */
  compareIds: string[]
  onToggleCompare: (productId: string, checked: boolean) => void
  onOpenProduct: (productId: string) => void
  /** 加入购物车 on the order card: record the choice and send its phrase. */
  onSpecSubmit: (choice: OrderChoice, phrase: string) => void
  busy: boolean
}

export function AssistantMessage({ convId, message, isLatest, onFollowup, compareIds, onToggleCompare, onOpenProduct, onSpecSubmit, busy }: Props) {
  const [params] = useSearchParams()
  const viewing = params.get('product')
  const { data: products } = useProducts(message.productIds)
  // Answers that arrive while on screen rise in; ones loaded from history don't.
  const [live] = useState(() => message.state === 'pending' || message.state === 'streaming')
  const rise = live ? 'animate-fade-up' : ''

  if (message.state === 'error') {
    return (
      <div className="flex max-w-[420px] flex-col gap-3">
        <div role="alert" className="flex flex-col gap-2 rounded-2xl border border-[rgba(194,78,58,0.35)] bg-surface p-3.5">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-error-text">
            <IconAlert />
            出错了
          </div>
          <div className="whitespace-pre-line text-[13px] leading-5">
            {message.error}
            {'\n建议：\n• 检查网络连接是否正常\n• 尝试简化搜索关键词\n• 稍后重新尝试'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void retry(convId, message.id)}
          className="flex h-10 items-center justify-center gap-1.5 rounded-[10px] bg-primary active:scale-[0.98] text-[15px] font-semibold text-on-primary"
        >
          <IconRetry />
          重新尝试
        </button>
        <span className="text-center text-xs text-ink-subtle">点击上方按钮重新搜索</span>
      </div>
    )
  }

  const opening = message.composer?.opening ?? message.text
  const working = message.state === 'pending' || (message.state === 'streaming' && !opening)
  const thinking = message.thinking && (
    <ThinkingBlock thinking={message.thinking} editable={isLatest && message.state === 'done' && !busy} onRefine={onFollowup} />
  )
  if (working) return message.retryAttempt || !message.thinking ? <StatusBubble text={message.status} retryAttempt={message.retryAttempt} /> : thinking

  const done = message.state === 'done'
  const descriptions = new Map(message.composer?.items.map((i) => [i.productId, i.description]) ?? [])
  const followups = isLatest && done ? message.composer?.followup ?? [] : []

  return (
    <div className="flex flex-col gap-3">
      {thinking}
      {opening && (
        // A live answer's bubble fades in where the status bubble was.
        <div className={`max-w-[640px] self-start whitespace-pre-line rounded-[18px] border border-line bg-surface px-4 py-[11px] text-[15px] leading-[22px] ${live ? 'animate-fade-in' : ''}`}>
          <StreamText text={opening} done={done} />
          {!done && <span aria-hidden="true" className="ml-0.5 inline-block h-[15px] w-0.5 animate-pulse bg-primary align-[-2px]" />}
        </div>
      )}

      {done && products && products.length > 0 && (
        <div className={`${rise} grid max-w-[860px] grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4`}>
          {products.map((p) => (
            <ProductCard
              key={p.productID}
              product={p}
              description={descriptions.get(p.productID)}
              viewing={viewing === p.productID}
              compareChecked={compareIds.includes(p.productID)}
              onToggleCompare={(on) => onToggleCompare(p.productID, on)}
              onOpen={() => onOpenProduct(p.productID)}
            />
          ))}
        </div>
      )}

      {done && message.comparison && (
        <div className={rise}>
          <InlineComparison comparison={message.comparison} convId={convId} />
        </div>
      )}

      {done && message.specSelection && (
        <div className={rise}>
          <SpecSelectionCard
            spec={message.specSelection}
            disabled={busy || !isLatest}
            onAddToCart={onSpecSubmit}
            onOrder={(choice) => placeOrder(convId, message.id, choice)}
          />
        </div>
      )}

      {followups.length > 0 && (
        <div className={`${rise} flex flex-wrap items-center gap-2`}>
          {followups.map((f) => (
            <button
              key={f}
              type="button"
              disabled={busy}
              onClick={() => onFollowup(f)}
              className="rounded-full bg-chip px-3.5 py-2 text-[13px] text-primary-text hover:bg-secondary active:scale-[0.97] disabled:opacity-50"
            >
              {f}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
