import { create } from 'zustand'
import type { Account } from '../api/types'

const KEY = 'cartpilot.auth'

interface Stored {
  token: string
  account: Account
}

function read(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Stored) : null
  } catch {
    return null
  }
}

interface AuthState {
  token: string | null
  account: Account | null
  signIn: (token: string, account: Account) => void
  signOut: () => void
}

/**
 * The logged-in account (api/auth.py). The token rides on every request as
 * `Authorization: Bearer …` (src/api/http.ts); without one the backend treats
 * the browser as the shared demo shopper, as before accounts existed.
 * Kept in localStorage so a reload stays signed in.
 */
export const useAuth = create<AuthState>((set) => {
  const stored = read()
  return {
    token: stored?.token ?? null,
    account: stored?.account ?? null,
    signIn: (token, account) => {
      try {
        localStorage.setItem(KEY, JSON.stringify({ token, account }))
      } catch {
        /* storage blocked: signed in for this tab only */
      }
      set({ token, account })
    },
    signOut: () => {
      try {
        localStorage.removeItem(KEY)
      } catch {
        /* ignore */
      }
      set({ token: null, account: null })
    },
  }
})

export const isSeller = (a: Account | null) => a?.role === 'merchant' || a?.role === 'admin'

export const ROLE_LABELS: Record<Account['role'], string> = { customer: '顾客', merchant: '商家', admin: '平台管理员' }
