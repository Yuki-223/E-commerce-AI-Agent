import { create } from 'zustand'

export type ThemeChoice = 'light' | 'dark' | 'system'
const KEY = 'cartpilot.theme'
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
  } catch {
    return 'system'
  }
}

/** Write data-theme on <html>; tokens.css swaps every color variable from it. */
function apply(choice: ThemeChoice) {
  const dark = choice === 'dark' || (choice === 'system' && Boolean(media?.matches))
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#13110F' : '#FBFAF7')
}

export const useTheme = create<{ choice: ThemeChoice; set: (c: ThemeChoice) => void }>((set) => ({
  choice: read(),
  set: (choice) => {
    try {
      localStorage.setItem(KEY, choice)
    } catch {
      /* ignore */
    }
    apply(choice)
    set({ choice })
  },
}))

export function initTheme() {
  apply(useTheme.getState().choice)
  media?.addEventListener('change', () => apply(useTheme.getState().choice))
}
