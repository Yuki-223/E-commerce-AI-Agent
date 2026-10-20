import { create } from 'zustand'

/** Phone drawer (MWebDrawer ⑬) open state. */
export const useDrawer = create<{ open: boolean; set: (open: boolean) => void }>((set) => ({
  open: false,
  set: (open) => set({ open }),
}))

export type SettingsTab = 'general' | 'preferences' | 'profiles' | 'addresses' | 'data'

/** Settings dialog (claude.ai-style floating window); null when closed. */
export const useSettings = create<{ tab: SettingsTab | null; open: (tab?: SettingsTab) => void; close: () => void }>((set) => ({
  tab: null,
  open: (tab = 'general') => set({ tab }),
  close: () => set({ tab: null }),
}))

const SIDEBAR_KEY = 'cartpilot.sidebarCollapsed'

/** Desktop sidebar collapsed to the icon rail; remembered per browser. */
export const useSidebar = create<{ collapsed: boolean; toggle: () => void }>((set, get) => ({
  collapsed: (() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === '1'
    } catch {
      return false
    }
  })(),
  toggle: () => {
    const collapsed = !get().collapsed
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
    set({ collapsed })
  },
}))
