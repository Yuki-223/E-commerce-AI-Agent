import { create } from 'zustand'

/** Phone drawer (MWebDrawer ⑬) open state. */
export const useDrawer = create<{ open: boolean; set: (open: boolean) => void }>((set) => ({
  open: false,
  set: (open) => set({ open }),
}))

export type SettingsTab = 'general' | 'preferences' | 'profiles' | 'data'

/** Settings dialog (claude.ai-style floating window); null when closed. */
export const useSettings = create<{ tab: SettingsTab | null; open: (tab?: SettingsTab) => void; close: () => void }>((set) => ({
  tab: null,
  open: (tab = 'general') => set({ tab }),
  close: () => set({ tab: null }),
}))
