import { apiFetch, ApiError } from './http'
import type { ChatRequest, SseEvent, SseEventName } from './types'

/** One `event:` / `data:` block before JSON decoding. */
export interface RawSseEvent {
  event: string
  data: string
}

const KNOWN_EVENTS: ReadonlySet<SseEventName> = new Set([
  'session', 'status', 'meta', 'tool_result', 'token', 'memory_update', 'done', 'error',
])

/**
 * Incremental SSE line parser, same rules as SSEDelegate in FrontendServices.swift:
 * split on \n, strip \r, `event:` sets the name, `data:` lines are joined with \n,
 * a blank line dispatches. Chunks may cut lines or UTF-8 sequences anywhere.
 */
export class SseParser {
  private buffer = ''
  private eventName = ''
  private dataLines: string[] = []
  private readonly decoder = new TextDecoder()

  push(chunk: Uint8Array | string): RawSseEvent[] {
    this.buffer += typeof chunk === 'string' ? chunk : this.decoder.decode(chunk, { stream: true })
    const out: RawSseEvent[] = []
    let idx: number
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, idx).replace(/\r$/, '')
      this.buffer = this.buffer.slice(idx + 1)
      this.handleLine(line, out)
    }
    return out
  }

  /** Flush a trailing line and an unterminated final block at end of stream. */
  end(): RawSseEvent[] {
    const out: RawSseEvent[] = []
    this.buffer += this.decoder.decode()
    if (this.buffer) {
      this.handleLine(this.buffer.replace(/\r$/, ''), out)
      this.buffer = ''
    }
    this.flush(out)
    return out
  }

  private handleLine(line: string, out: RawSseEvent[]) {
    if (line === '') return this.flush(out)
    if (line.startsWith(':')) return // comment / keep-alive
    if (line.startsWith('event:')) this.eventName = line.slice(6).trim()
    else if (line.startsWith('data:')) this.dataLines.push(line.slice(5).replace(/^ /, ''))
  }

  private flush(out: RawSseEvent[]) {
    if (!this.eventName && this.dataLines.length === 0) return
    out.push({ event: this.eventName || 'message', data: this.dataLines.join('\n') })
    this.eventName = ''
    this.dataLines = []
  }
}

/**
 * Decode a raw block into a typed event. Every backend payload is JSON (token data
 * is a JSON string); unknown names return null and are ignored like iOS does.
 */
export function decodeSseEvent(raw: RawSseEvent): SseEvent | null {
  if (!KNOWN_EVENTS.has(raw.event as SseEventName)) return null
  let data: unknown
  try {
    data = JSON.parse(raw.data)
  } catch {
    // iOS falls back to the raw text for a non-JSON token; other events are dropped.
    if (raw.event === 'token') return { event: 'token', data: raw.data }
    return null
  }
  return { event: raw.event, data } as SseEvent
}

/** Read a byte stream to typed events. */
export async function* readSseStream(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  const reader = body.getReader()
  const parser = new SseParser()
  try {
    for (;;) {
      const { value, done } = await reader.read()
      const raws = done ? parser.end() : parser.push(value)
      for (const raw of raws) {
        const ev = decodeSseEvent(raw)
        if (ev) yield ev
      }
      if (done) return
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * POST /chat/stream. EventSource cannot POST, so this is fetch + ReadableStream.
 * Yields every event including `error`; the caller decides how to render it.
 */
export async function* streamChat(req: ChatRequest, signal?: AbortSignal): AsyncGenerator<SseEvent> {
  const res = await apiFetch('/chat/stream', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(req),
  })
  if (!res.ok || !res.body) {
    throw new ApiError(res.status, `API_HTTP_${res.status}`, 'Agent 服务请求失败。')
  }
  yield* readSseStream(res.body)
}
