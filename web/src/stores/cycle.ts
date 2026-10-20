import { create } from 'zustand'
import type { CycleSettings } from '../lib/cycle'

const KEY = 'cartpilot.cycle'

function read(): CycleSettings | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as CycleSettings) : null
  } catch {
    return null
  }
}

/** 经期关怀 settings. Health data stays in this browser's localStorage only. */
export const useCycle = create<{ settings: CycleSettings | null; save: (s: CycleSettings) => void; clear: () => void }>((set) => ({
  settings: read(),
  save: (settings) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings))
    } catch {
      /* blocked storage: keep it for this tab */
    }
    set({ settings })
  },
  clear: () => {
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
    set({ settings: null })
  },
}))
