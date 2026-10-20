import { useAuth } from '../stores/auth'
import type { ApiErrorPayload } from './types'

/** The single switch between the in-browser mock backend and the real FastAPI backend. */
export const USE_MOCK = __USE_MOCK__

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
  const token = useAuth.getState().token
  if (token) {
    const headers = new Headers(init?.headers)
    headers.set('Authorization', `Bearer ${token}`)
    init = { ...init, headers }
  }
  let res: Response
  try {
    // A compile-time constant, so builds without the flag drop the mock chunk entirely.
    if (__USE_MOCK__) {
      const { mockFetch } = await import('../mock/server')
      res = await mockFetch(path, init)
    } else {
      res = await fetch(API_BASE + path, init)
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError(0, 'API_CONNECTION_FAILED', '后端服务暂时不可用，请确认后端已启动。', true)
  }
  // An expired or revoked token: drop it so the next request goes out as the demo shopper.
  if (res.status === 401 && token && !path.startsWith('/auth/login') && useAuth.getState().token === token) useAuth.getState().signOut()
  return res
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

export const deleteJSON = <T>(path: string) => requestJSON<T>(path, { method: 'DELETE' })

export const sendJSON = <T>(method: 'POST' | 'PUT', path: string, body: unknown, signal?: AbortSignal) =>
  requestJSON<T>(path, {
    method,
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
