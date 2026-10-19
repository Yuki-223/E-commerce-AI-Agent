import { create } from 'zustand'

/** Phone drawer (MWebDrawer ⑬) open state. */
export const useDrawer = create<{ open: boolean; set: (open: boolean) => void }>((set) => ({
  open: false,
  set: (open) => set({ open }),
}))
