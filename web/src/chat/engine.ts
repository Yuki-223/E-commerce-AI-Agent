/**
 * Runs one /chat/stream turn and folds the events into the conversation store.
 * Lives outside React so a stream keeps going while the user navigates.
 */
import type { QueryClient } from '@tanstack/react-query'
import { interpretToolResult, parseComposerJson } from '../api/agentEvents'
import { api } from '../api/endpoints'
import { ApiError } from '../api/http'
import { streamChat } from '../api/sse'
import type { CartResponse, ChatRequest, UserPreference } from '../api/types'
import { CART_KEY } from '../hooks/useCart'
import { withProductRef, type ProductRef } from '../lib/productRef'
import { preferenceKey } from '../hooks/usePreference'
import { useConversations, type ChatMessage, type OrderChoice } from '../stores/conversations'
import { toast } from '../stores/toast'
import { finishThinking, onMeta, onStatus, onToolResult, startThinking } from './thinking'

let queryClient: QueryClient | null = null
const controllers = new Map<string, AbortController>()

/** Delays used to reveal the composer's opening line, as GuideView.streamDelay does. */
const CHAR_DELAY = 22
/** Auto-retries for a dropped connection before any answer arrived (WebStates ④). */
const MAX_AUTO_RETRIES = 2

export function bindQueryClient(qc: QueryClient) {
  queryClient = qc
}

const store = () => useConversations.getState()
const uid = () => crypto.randomUUID()
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function isStreaming(convId: string): boolean {
  return controllers.has(convId)
}

export function stop(convId: string) {
  controllers.get(convId)?.abort()
}

export interface SendInput {
  text: string
  /** data: URL of a compressed JPEG. */
  image?: string
  refProduct?: ProductRef
  userId: string
}

/** Append a user turn plus a pending assistant turn, then stream the answer. */
export async function send(convId: string, input: SendInput) {
  const s = store()
  let conv = s.conversations[convId]
  if (!conv) conv = s.create(convId, input.text.trim() || (input.refProduct ? input.refProduct.title : '图片搜索'))
  const isFirstTurn = conv.messages.length === 0

  const userMsg: ChatMessage = { id: uid(), role: 'user', createdAt: Date.now(), text: input.text.trim(), image: input.image, refProduct: input.refProduct }
  s.upsertMessage(convId, userMsg)

  const request: ChatRequest = {
    query: withProductRef(input.text, input.refProduct),
    session_id: conv.sessionId ?? null,
    user_id: input.userId,
    image_base64: input.image ?? null,
  }
  const assistantId = uid()
  s.upsertMessage(convId, { id: assistantId, role: 'assistant', createdAt: Date.now(), text: '', state: 'pending', request, thinking: startThinking() })
  await run(convId, assistantId, request)

  if (isFirstTurn) void nameConversation(convId, [input.refProduct?.title, input.text.trim()].filter(Boolean).join(' '))
}

/** 重新尝试: resend the stored request into the same assistant message. */
export async function retry(convId: string, assistantId: string) {
  const msg = store().conversations[convId]?.messages.find((m) => m.id === assistantId)
  if (!msg?.request) return
  const sessionId = store().conversations[convId]?.sessionId
  const request = { ...msg.request, session_id: sessionId ?? msg.request.session_id }
  store().patchMessage(convId, assistantId, {
    state: 'pending', error: undefined, status: undefined, retryAttempt: undefined, text: '', composer: null,
    productIds: undefined, comparison: null, specSelection: null, memory: undefined, thinking: startThinking(),
  })
  await run(convId, assistantId, request)
}

async function run(convId: string, msgId: string, request: ChatRequest) {
  const controller = new AbortController()
  controllers.set(convId, controller)
  const patch = (p: Partial<ChatMessage> | ((m: ChatMessage) => Partial<ChatMessage>)) => store().patchMessage(convId, msgId, p)

  let narrative = ''
  let gotAnswer = false
  let attempt = 0
  try {
    for (;;) {
      try {
        for await (const ev of streamChat(request, controller.signal)) {
          switch (ev.event) {
            case 'session':
              store().patch(convId, { sessionId: ev.data.session_id })
              request.session_id = ev.data.session_id
              break
            case 'status':
              patch((m) => ({ status: ev.data.message, statusPhase: ev.data.phase, retryAttempt: undefined, thinking: m.thinking && onStatus(m.thinking, ev.data) }))
              break
            case 'meta':
              patch((m) => ({ thinking: m.thinking && onMeta(m.thinking, ev.data) }))
              break
            case 'tool_result': {
              gotAnswer = true
              patch((m) => ({ thinking: m.thinking && onToolResult(m.thinking, ev.data) }))
              const effect = interpretToolResult(ev.data)
              if (effect.kind === 'products') patch({ productIds: effect.productIds })
              else if (effect.kind === 'specSelection') {
                patch({ specSelection: { product_id: effect.productId, title: effect.title, dimensions: effect.dimensions, quantity: effect.quantity, skus: effect.skus } })
              } else if (effect.kind === 'comparison') patch({ comparison: effect.comparison })
              else if (effect.kind === 'cart') {
                patch({ cartAction: effect.action })
                if (effect.cart) queryClient?.setQueryData<CartResponse>(CART_KEY, { cart: effect.cart })
                if (effect.added) {
                  const spec = Object.values(effect.added.options).join(' / ')
                  toast({ title: '已加入购物车', detail: `数量 ${effect.added.quantity}${spec ? ` · 规格：${spec}` : ''}`, action: { label: '去看看', to: '/cart' } })
                }
              }
              break
            }
            case 'token':
              gotAnswer = true
              narrative += ev.data
              patch((m) => ({ state: 'streaming', thinking: m.thinking && finishThinking(m.thinking) }))
              break
            case 'memory_update':
              patch((m) => ({ memory: [...(m.memory ?? []), ev.data] }))
              queryClient?.setQueryData<UserPreference>(preferenceKey(request.user_id ?? ''), ev.data.preference)
              break
            case 'done':
              if (!narrative) narrative = ev.data.narrative ?? ''
              break
            case 'error':
              throw new ApiError(500, 'AGENT_STREAM_ERROR', ev.data.message || 'Agent 流式处理失败。')
          }
        }
        break
      } catch (err) {
        const dropped = err instanceof ApiError && err.status === 0
        if (dropped && !gotAnswer && attempt < MAX_AUTO_RETRIES && !controller.signal.aborted) {
          attempt += 1
          patch({ retryAttempt: attempt, status: undefined })
          await sleep(1200 * attempt)
          continue
        }
        throw err
      }
    }
    await reveal(convId, msgId, narrative)
  } catch (err) {
    if (controller.signal.aborted) {
      patch((m) => ({ state: 'done', text: m.text || narrative || '已停止生成。', status: undefined, thinking: m.thinking && finishThinking(m.thinking) }))
    } else {
      patch({ state: 'error', error: describeError(err), status: undefined, retryAttempt: undefined })
    }
  } finally {
    controllers.delete(convId)
    store().patch(convId, { updatedAt: Date.now() })
  }
}

/** Type out the composer opening (or the plain narrative), then mark the turn done. */
async function reveal(convId: string, msgId: string, narrative: string) {
  const patch = (p: Partial<ChatMessage>) => store().patchMessage(convId, msgId, p)
  const composer = parseComposerJson(narrative)
  const full = composer ? composer.opening : narrative.trim()
  const chars = Array.from(full)
  const step = chars.length > 120 ? 3 : 1
  for (let i = step; i < chars.length; i += step) {
    const shown = chars.slice(0, i).join('')
    patch(composer ? { composer: { ...composer, opening: shown, followup: [] }, text: '' } : { text: shown })
    await sleep(CHAR_DELAY)
  }
  patch({ state: 'done', status: undefined, composer, text: composer ? '' : full || '好的。' })
}

/** 直接下单 from the order card: POST /orders, then the card turns into the receipt. */
export async function placeOrder(convId: string, msgId: string, choice: OrderChoice) {
  const conv = store().conversations[convId]
  const spec = conv?.messages.find((m) => m.id === msgId)?.specSelection
  if (!spec) return
  try {
    const { order, cart } = await api.order({
      items: [{ productID: spec.product_id, skuID: choice.skuId, quantity: choice.quantity }],
      session_id: conv.sessionId ?? null,
    })
    store().patchMessage(convId, msgId, { specSelection: { ...spec, chosen: choice.chosen, chosenQuantity: choice.quantity, order } })
    queryClient?.setQueryData<CartResponse>(CART_KEY, { cart })
  } catch (err) {
    toast({ tone: 'error', title: '下单失败', detail: err instanceof ApiError ? err.message : '请稍后再试' })
  }
}

export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return '连接失败\n失败原因：商品服务暂时不可用，请确认后端 REST API 已启动。'
    return `请求失败\n失败原因：${err.message}`
  }
  return `请求失败\n失败原因：${err instanceof Error ? err.message : String(err)}`
}

/** POST /title after the first turn; fall back to the first 12 characters like iOS. */
async function nameConversation(convId: string, userText: string) {
  if (!userText) return
  const conv = store().conversations[convId]
  const assistant = conv?.messages.find((m) => m.role === 'assistant')
  try {
    const { title } = await api.title(userText, assistant?.composer?.opening || assistant?.text)
    if (title.trim()) store().patch(convId, { title: title.trim() })
  } catch {
    store().patch(convId, { title: Array.from(userText).slice(0, 12).join('') })
  }
}
