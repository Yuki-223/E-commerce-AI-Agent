import { beforeEach, describe, expect, it } from 'vitest'
import { interpretToolResult, parseComposerJson } from './agentEvents'
import { decodeSseEvent, readSseStream, SseParser } from './sse'
import type { SseEvent, SseEventName, ToolResultEventData } from './types'
import { mockFetch } from '../mock/server'

const enc = new TextEncoder()

function streamOf(...chunks: (string | Uint8Array)[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(typeof ch === 'string' ? enc.encode(ch) : ch)
      c.close()
    },
  })
}

async function collect(body: ReadableStream<Uint8Array>): Promise<SseEvent[]> {
  const out: SseEvent[] = []
  for await (const ev of readSseStream(body)) out.push(ev)
  return out
}

/** The exact framing main.py's _format_sse writes. */
const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`

describe('SseParser', () => {
  it('reassembles events split across arbitrary chunk boundaries', () => {
    const wire = frame('session', { session_id: 's1' }) + frame('token', '你好')
    const p = new SseParser()
    const got = [...wire].flatMap((ch) => p.push(ch))
    expect(got).toEqual([
      { event: 'session', data: '{"session_id":"s1"}' },
      { event: 'token', data: '"你好"' },
    ])
  })

  it('handles CRLF, multi-line data, comments and a final block without a blank line', () => {
    const p = new SseParser()
    const got = [...p.push(': keep-alive\r\nevent: token\r\ndata: "a\r\ndata: b"\r\n\r\nevent: done\ndata: {}'), ...p.end()]
    expect(got).toEqual([
      { event: 'token', data: '"a\nb"' },
      { event: 'done', data: '{}' },
    ])
  })

  it('does not corrupt multi-byte UTF-8 split between chunks', async () => {
    const bytes = enc.encode(frame('token', '防晒'))
    const events = await collect(streamOf(bytes.slice(0, 18), bytes.slice(18)))
    expect(events).toEqual([{ event: 'token', data: '防晒' }])
  })
})

describe('decodeSseEvent', () => {
  const samples: Record<SseEventName, unknown> = {
    session: { session_id: 'abc' },
    status: { phase: 'tool', tool: 'recommend', message: '正在为你检索商品…' },
    meta: { decision: { tool: 'recommend', rewritten_query: 'q', confidence: 'high', reasoning: '' }, trace: { timings: {} } },
    tool_result: { tool_name: 'recommend', payload: { products: [] }, composer_hint: null, narrative_override: null, needs_composer: true },
    token: '{"opening":"为你推荐了","items":[],"followup":[]}',
    memory_update: { message: '已记住：常用预算 ¥500 以内', field: 'budget_max', value: 500, source: 'auto', undo_token: 'undo_x', preference: {} },
    done: { timings: { composer_ms: 1 }, narrative: 'x' },
    error: { message: 'RuntimeError: boom' },
  }

  it.each(Object.entries(samples))('decodes %s', (name, data) => {
    expect(decodeSseEvent({ event: name, data: JSON.stringify(data) })).toEqual({ event: name, data })
  })

  it('ignores unknown events and falls back to raw text for a non-JSON token', () => {
    expect(decodeSseEvent({ event: 'ping', data: '{}' })).toBeNull()
    expect(decodeSseEvent({ event: 'token', data: 'plain' })).toEqual({ event: 'token', data: 'plain' })
  })
})

describe('interpretToolResult', () => {
  const tr = (tool_name: string, payload: unknown): ToolResultEventData => ({ tool_name, payload: payload as never })
  const cart = { lines: [], item_count: 0, total: 0 }

  it('extracts product ids in order from recommend', () => {
    expect(interpretToolResult(tr('recommend', { products: [{ product_id: 'b' }, { product_id: 'a' }] }))).toEqual({ kind: 'products', productIds: ['b', 'a'] })
  })
  it('prefers spec selection for cart ask_spec', () => {
    const effect = interpretToolResult(tr('cart', { action: 'ask_spec', product_id: 'p', title: 't', dimensions: [{ name: '规格', values: ['a', 'b'] }], options: {} }))
    expect(effect).toMatchObject({ kind: 'specSelection', productId: 'p' })
  })
  it('returns the cart snapshot for add / view and an empty cart for checkout', () => {
    expect(interpretToolResult(tr('cart', { action: 'add', added: {}, cart }))).toEqual({ kind: 'cart', action: 'add', cart })
    expect(interpretToolResult(tr('cart', { action: 'checkout', order: {} }))).toMatchObject({ kind: 'cart', cart: { item_count: 0 } })
    expect(interpretToolResult(tr('cart', { action: 'noop' }))).toEqual({ kind: 'cart', action: 'noop', cart: null })
  })
  it('returns a comparison only when present', () => {
    expect(interpretToolResult(tr('compare', { action: 'compare', comparison: null }))).toEqual({ kind: 'none' })
    expect(interpretToolResult(tr('compare', { action: 'compare', comparison: { title: 't', products: [], rows: [], recommendation: '' } })).kind).toBe('comparison')
  })
})

describe('parseComposerJson', () => {
  it('parses composer JSON and leaves plain text alone', () => {
    expect(parseComposerJson('{"opening":"o","items":[{"productId":"p","description":"d"}],"questions":["q"]}')).toEqual({
      opening: 'o', items: [{ productId: 'p', description: 'd' }], followup: ['q'],
    })
    expect(parseComposerJson('已把「x」加入购物车')).toBeNull()
  })
})

describe('mock /chat/stream end to end', () => {
  beforeEach(() => localStorage.clear())

  async function turn(body: Record<string, unknown>) {
    const res = await mockFetch('/chat/stream', { method: 'POST', body: JSON.stringify({ user_id: 'local-user', ...body }) })
    expect(res.headers.get('Content-Type')).toBe('text/event-stream')
    return collect(res.body!)
  }

  it('emits the backend event order for a recommendation', async () => {
    const events = await turn({ query: '推荐一款 500 元以内、不要含酒精的防晒' })
    expect(events.map((e) => e.event)).toEqual(['session', 'status', 'meta', 'status', 'tool_result', 'status', 'token', 'done'])
    const tool = events.find((e) => e.event === 'tool_result')!
    expect(interpretToolResult(tool.data as ToolResultEventData)).toEqual({ kind: 'products', productIds: ['p_beauty_006', 'p_beauty_023'] })
    const token = events.find((e) => e.event === 'token')!.data as string
    expect(parseComposerJson(token)?.items.map((i) => i.productId)).toEqual(['p_beauty_006', 'p_beauty_023'])
  }, 15000)

  it('emits memory_update before done and supports undo', async () => {
    const events = await turn({ query: '我预算 500 以内' })
    const names = events.map((e) => e.event)
    expect(names.indexOf('memory_update')).toBeLessThan(names.indexOf('done'))
    const mem = events.find((e) => e.event === 'memory_update')!.data as { undo_token: string; message: string }
    expect(mem.message).toBe('已记住：常用预算 ¥500 以内')
    const undo = await mockFetch('/preferences/local-user/undo', { method: 'POST', body: JSON.stringify({ undo_token: mem.undo_token }) })
    expect((await undo.json()).preference.budget_max).toBeNull()
    const again = await mockFetch('/preferences/local-user/undo', { method: 'POST', body: JSON.stringify({ undo_token: mem.undo_token }) })
    expect(again.status).toBe(404)
  }, 15000)

  it('streams error when the backend fails', async () => {
    localStorage.setItem('cartpilot.mock.ctl', JSON.stringify({ failNext: 1 }))
    const events = await turn({ query: '随便看看' })
    expect(events.at(-1)).toMatchObject({ event: 'error' })
  }, 15000)

  it('asks for a spec, then adds to the cart through the cart tool', async () => {
    const first = await turn({ query: '推荐一款 500 元以内、不要含酒精的防晒' })
    const sid = (first[0].data as { session_id: string }).session_id
    const ask = await turn({ query: '把第一个加入购物车', session_id: sid })
    const askEffect = interpretToolResult(ask.find((e) => e.event === 'tool_result')!.data as ToolResultEventData)
    expect(askEffect).toMatchObject({ kind: 'specSelection', productId: 'p_beauty_006' })
    const add = await turn({ query: '40ml 清爽型', session_id: sid })
    const addEffect = interpretToolResult(add.find((e) => e.event === 'tool_result')!.data as ToolResultEventData)
    expect(addEffect).toMatchObject({ kind: 'cart', action: 'add', cart: { item_count: 1, total: 190 } })
  }, 20000)
})
