import type { ApiErrorPayload } from './types'

/** The single switch between the in-browser mock backend and the real FastAPI backend. */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK === '1'

/** Same-origin prefix; vite.config.ts proxies it to http://127.0.0.1:8000. */
export const API_BASE = '/api'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable = status >= 500,
  ) {
    super(message)
  }
}

/**
 * fetch() against a backend path such as `/cart`. In mock mode the request is
 * answered by src/mock/server.ts with a real Response object (SSE included), so
 * every parser above this layer runs unchanged in both modes.
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    if (USE_MOCK) {
      const { mockFetch } = await import('../mock/server')
      return await mockFetch(path, init)
    }
    return await fetch(API_BASE + path, init)
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError(0, 'API_CONNECTION_FAILED', '后端服务暂时不可用，请确认后端已启动。', true)
  }
}

async function errorFrom(res: Response): Promise<ApiError> {
  let body: unknown
  try {
    body = await res.json()
  } catch {
    body = null
  }
  const p = (body ?? {}) as Partial<ApiErrorPayload> & { detail?: Partial<ApiErrorPayload> }
  const payload = p.code ? p : p.detail
  return new ApiError(
    res.status,
    payload?.code ?? `API_HTTP_${res.status}`,
    payload?.message ?? `请求失败（HTTP ${res.status}）`,
    payload?.retryable ?? res.status >= 500,
  )
}

export async function requestJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init)
  if (!res.ok) throw await errorFrom(res)
  return (await res.json()) as T
}

export const getJSON = <T>(path: string, signal?: AbortSignal) => requestJSON<T>(path, { signal })

export const sendJSON = <T>(method: 'POST' | 'PUT', path: string, body: unknown, signal?: AbortSignal) =>
  requestJSON<T>(path, {
    method,
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
