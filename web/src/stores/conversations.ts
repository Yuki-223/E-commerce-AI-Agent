import { create } from 'zustand'
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
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  createdAt: number
  /** User text, or the assistant's plain narrative (non-JSON tools). */
  text: string
  /** User attachment as a data URL thumbnail. */
  image?: string
  state?: MessageState
  /** Latest status.message while working. */
  status?: string
  statusPhase?: string
  composer?: ComposerJson | null
  productIds?: string[]
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
  remove: (convId: string) => void
  clear: () => void
}

export const useConversations = create<ConversationsState>((set, get) => ({
  conversations: {},
  loaded: true,
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
