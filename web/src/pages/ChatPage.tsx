import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { isStreaming, send, stop } from '../chat/engine'
import { CartButton } from '../components/CartButton'
import { AssistantMessage } from '../components/chat/AssistantMessage'
import { Composer, type ComposerHandle } from '../components/chat/Composer'
import { MemoryBanner } from '../components/chat/MemoryBanner'
import { UserMessage } from '../components/chat/UserMessage'
import { IconArrowDown } from '../components/Icons'
import { MainHeader } from '../components/layout/MainHeader'
import { MenuButton, MobileCartLink, MobileHeader } from '../components/layout/MobileHeader'
import { useIsNarrow } from '../hooks/useIsNarrow'
import { useConversations } from '../stores/conversations'
import { useActiveProfile } from '../stores/profiles'

/** ⑩ conversation view: messages, cards, follow-ups and the bottom composer. */
export function ChatPage() {
  const { conversationId = '' } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const profile = useActiveProfile()
  const conv = useConversations((s) => s.conversations[conversationId])
  const loaded = useConversations((s) => s.loaded)
  const patchMessage = useConversations((s) => s.patchMessage)
  const narrow = useIsNarrow()
  const composer = useRef<ComposerHandle | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const [atBottom, setAtBottom] = useState(true)

  const messages = conv?.messages ?? []
  const last = messages[messages.length - 1]
  const memoryMsg = [...messages].reverse().find((m) => m.memory?.length)
  const busy = last?.role === 'assistant' && (last.state === 'pending' || last.state === 'streaming') && isStreaming(conversationId)

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  // Follow new content while the reader is at the bottom; otherwise offer 回到最新.
  useLayoutEffect(() => {
    if (atBottom) scrollToBottom()
  }, [messages, atBottom, scrollToBottom])

  useEffect(() => {
    setAtBottom(true)
    requestAnimationFrame(() => scrollToBottom())
  }, [conversationId, scrollToBottom])

  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 48)
  }

  const openProduct = (productId: string) => {
    const next = new URLSearchParams(params)
    next.set('product', productId)
    setParams(next)
  }

  if (!conv) {
    if (!loaded) return null
    return (
      <div className="flex grow flex-col items-center justify-center gap-3 text-ink-muted">
        <p className="m-0">这段对话不存在或已被删除。</p>
        <button type="button" onClick={() => navigate('/')} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white">
          开始新对话
        </button>
      </div>
    )
  }

  return (
    <>
      {narrow ? (
        <MobileHeader left={<MenuButton />} right={<MobileCartLink />}>
          <span className="font-logo text-xl leading-[1.1] tracking-[0.3px]">CartPilot</span>
          <span className="max-w-[220px] truncate text-[11px] text-ink-subtle">{conv.title}</span>
        </MobileHeader>
      ) : (
        <MainHeader title={conv.title}>
          <CartButton />
        </MainHeader>
      )}
      {memoryMsg && <MemoryBanner key={memoryMsg.id} convId={conv.id} message={memoryMsg} />}
      <div className="relative min-h-0 grow">
        <div ref={scroller} onScroll={onScroll} className="h-full overflow-y-auto px-4 pb-4 pt-4 md:px-8 md:pt-6">
          <div className="mx-auto flex max-w-[820px] flex-col gap-4">
            {messages.map((m, i) =>
              m.role === 'user' ? (
                <UserMessage key={m.id} message={m} />
              ) : (
                <AssistantMessage
                  key={m.id}
                  convId={conv.id}
                  message={m}
                  isLatest={i === messages.length - 1}
                  onFollowup={(t) => composer.current?.setText(t)}
                  onOpenProduct={openProduct}
                  busy={busy}
                  onSpecSubmit={(chosen, phrase) => {
                    patchMessage(conv.id, m.id, { specSelection: { ...m.specSelection!, chosen } })
                    setAtBottom(true)
                    void send(conv.id, { text: phrase, userId: profile.userId })
                  }}
                />
              ),
            )}
          </div>
        </div>
        {!atBottom && (
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-3 left-1/2 flex h-[34px] -translate-x-1/2 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-[13px] font-semibold text-ink shadow-[0_6px_16px_rgba(43,30,18,0.12)]"
          >
            <IconArrowDown />
            回到最新
          </button>
        )}
      </div>
      <div className="shrink-0 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 md:px-8 md:pb-[18px] md:pt-3">
        <div className="mx-auto max-w-[820px]">
          <Composer
            variant="chat"
            busy={busy}
            onStop={() => stop(conv.id)}
            handleRef={(h) => (composer.current = h)}
            onSend={(text, image) => {
              setAtBottom(true)
              void send(conv.id, { text, image, userId: profile.userId })
            }}
          />
          <div className="mt-2 hidden text-center text-xs text-ink-subtle md:block">Enter 发送 · Shift + Enter 换行 · 价格与库存以商品库为准</div>
        </div>
      </div>
    </>
  )
}
