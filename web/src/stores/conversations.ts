import type { ProductRef } from '../lib/productRef'
import { create } from 'zustand'
import { loadConversations, saveConversations } from '../lib/db'
import type { ChatRequest, Comparison, ComposerJson, MemoryUpdateEventData, SpecDimension } from '../api/types'

export type MessageState = 'pending' | 'streaming' | 'done' | 'error'

export interface SpecSelection {
  product_id: string
  title: string
  dimensions: SpecDimension[]
  /** Set once the user confirmed a choice in the card. */
  chosen?: Record<string, string>
}

export interface MemoryNotice extends MemoryUpdateEventData {
  undone?: boolean
  undoError?: boolean
  dismissed?: boolean
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  createdAt: number
  /** User text, or the assistant's plain narrative (non-JSON tools). */
  text: string
  /** User attachment as a data URL thumbnail. */
  image?: string
  /** Product attached from the composer's 引用商品; shown as a chip above the bubble. */
  refProduct?: ProductRef
  state?: MessageState
  /** Latest status.message while working. */
  status?: string
  statusPhase?: string
  composer?: ComposerJson | null
  productIds?: string[]
  /** Cards ticked 加入对比 under this answer. */
  compareIds?: string[]
  comparison?: Comparison | null
  specSelection?: SpecSelection | null
  cartAction?: string
  memory?: MemoryNotice[]
  error?: string
  /** Auto-retry attempt shown as "正在第 N 次重试". */
  retryAttempt?: number
  /** Original request, kept so 重新尝试 can resend it. */
  request?: ChatRequest
}

export interface Conversation {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  /** Backend session_id from the first `session` event. */
  sessionId?: string
  messages: ChatMessage[]
}

interface ConversationsState {
  conversations: Record<string, Conversation>
  loaded: boolean
  create: (id: string, firstText: string) => Conversation
  upsertMessage: (convId: string, msg: ChatMessage) => void
  patchMessage: (convId: string, msgId: string, patch: Partial<ChatMessage> | ((m: ChatMessage) => Partial<ChatMessage>)) => void
  patch: (convId: string, patch: Partial<Conversation>) => void
  rename: (convId: string, title: string) => void
  remove: (convId: string) => void
  clear: () => void
}

export const useConversations = create<ConversationsState>((set, get) => ({
  conversations: {},
  loaded: false,
  create: (id, firstText) => {
    const now = Date.now()
    const conv: Conversation = { id, title: firstText.slice(0, 24) || '图片搜索', createdAt: now, updatedAt: now, messages: [] }
    set((s) => ({ conversations: { ...s.conversations, [id]: conv } }))
    return get().conversations[id]
  },
  upsertMessage: (convId, msg) =>
    set((s) => {
      const conv = s.conversations[convId]
      if (!conv) return s
      const exists = conv.messages.some((m) => m.id === msg.id)
      const messages = exists ? conv.messages.map((m) => (m.id === msg.id ? msg : m)) : [...conv.messages, msg]
      return { conversations: { ...s.conversations, [convId]: { ...conv, messages, updatedAt: Date.now() } } }
    }),
  patchMessage: (convId, msgId, patch) =>
    set((s) => {
      const conv = s.conversations[convId]
      if (!conv) return s
      const messages = conv.messages.map((m) => (m.id === msgId ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) } : m))
      return { conversations: { ...s.conversations, [convId]: { ...conv, messages } } }
    }),
  patch: (convId, patch) =>
    set((s) => {
      const conv = s.conversations[convId]
      if (!conv) return s
      return { conversations: { ...s.conversations, [convId]: { ...conv, ...patch } } }
    }),
  rename: (convId, title) =>
    set((s) => {
      const conv = s.conversations[convId]
      const clean = title.trim()
      if (!conv || !clean) return s
      return { conversations: { ...s.conversations, [convId]: { ...conv, title: clean } } }
    }),
  remove: (convId) =>
    set((s) => {
      const next = { ...s.conversations }
      delete next[convId]
      return { conversations: next }
    }),
  clear: () => set({ conversations: {} }),
}))

/** Distinct products recommended in a conversation, for the sidebar subtitle. */
export function productCount(conv: Conversation): number {
  return new Set(conv.messages.flatMap((m) => m.productIds ?? [])).size
}

/**
 * Load history from IndexedDB, then mirror every change back. A turn that was
 * still streaming when the page closed is marked failed so it can be retried.
 */
export async function hydrateConversations() {
  let stored: Conversation[] = []
  try {
    stored = await loadConversations()
  } catch {
    /* private mode or blocked storage: run in memory */
  }
  const map: Record<string, Conversation> = {}
  for (const c of stored) {
    map[c.id] = {
      ...c,
      messages: c.messages.map((m) =>
        m.state === 'pending' || m.state === 'streaming'
          ? { ...m, state: 'error' as const, error: '连接中断\n失败原因：页面在回答完成前被关闭或刷新。', status: undefined }
          : m,
      ),
    }
  }
  useConversations.setState((s) => ({ conversations: { ...map, ...s.conversations }, loaded: true }))

  let prev = useConversations.getState().conversations
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending = new Set<string>()
  useConversations.subscribe((state) => {
    const next = state.conversations
    if (next === prev) return
    for (const id of new Set([...Object.keys(prev), ...Object.keys(next)])) if (prev[id] !== next[id]) pending.add(id)
    prev = next
    timer ??= setTimeout(() => {
      timer = null
      const ids = pending
      pending = new Set()
      const all = useConversations.getState().conversations
      const changed = [...ids].map((id) => all[id]).filter((c): c is Conversation => Boolean(c) && c.messages.length > 0)
      const removed = [...ids].filter((id) => !all[id])
      void saveConversations(changed, removed).catch(() => undefined)
    }, 400)
  })
}
