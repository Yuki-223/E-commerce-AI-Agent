import { create } from 'zustand'

export interface Toast {
  id: number
  title: string
  detail?: string
  /** Optional link shown on the right, e.g. 去看看 → /cart. */
  action?: { label: string; to: string }
  tone?: 'success' | 'error'
}

interface ToastState {
  toasts: Toast[]
  show: (t: Omit<Toast, 'id'>) => void
  dismiss: (id: number) => void
}

let seq = 0

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  show: (t) => {
    const id = ++seq
    set({ toasts: [...get().toasts.slice(-2), { ...t, id }] })
    setTimeout(() => get().dismiss(id), 4000)
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))

export const toast = (t: Omit<Toast, 'id'>) => useToasts.getState().show(t)
