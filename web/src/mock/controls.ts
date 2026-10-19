/**
 * Switches for reproducing backend states in mock mode (WebStates.dc.html).
 * Set from the browser console, e.g. `__cartpilotMock.offline(true)`, or with
 * `?mock=offline` / `?mock=fail` / `?mock=slow` on any URL.
 */
const KEY = 'cartpilot.mock.ctl'

interface Ctl {
  offline: boolean
  failNext: number
  slow: boolean
}

function read(): Ctl {
  try {
    return { offline: false, failNext: 0, slow: false, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return { offline: false, failNext: 0, slow: false }
  }
}

function write(c: Ctl) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c))
  } catch {
    /* ignore */
  }
}

export const mockCtl = {
  get offline() {
    return read().offline
  },
  get slow() {
    return read().slow
  },
  /** Returns true once per armed failure; the next /chat/stream emits `error`. */
  consumeFailure(): boolean {
    const c = read()
    if (c.failNext <= 0) return false
    write({ ...c, failNext: c.failNext - 1 })
    return true
  },
}

const api = {
  offline(on = true) {
    write({ ...read(), offline: on })
  },
  failNext(n = 1) {
    write({ ...read(), failNext: n })
  },
  slow(on = true) {
    write({ ...read(), slow: on })
  },
  reset() {
    for (const k of Object.keys(localStorage)) if (k.startsWith('cartpilot.mock.')) localStorage.removeItem(k)
  },
  state: read,
}

declare global {
  interface Window {
    __cartpilotMock?: typeof api
  }
}

if (typeof window !== 'undefined') {
  window.__cartpilotMock = api
  const flag = new URLSearchParams(window.location.search).get('mock')
  if (flag === 'offline') api.offline(true)
  if (flag === 'online') api.offline(false)
  if (flag === 'fail') api.failNext(1)
  if (flag === 'slow') api.slow(true)
}
