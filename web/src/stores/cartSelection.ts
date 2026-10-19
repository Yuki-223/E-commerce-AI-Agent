import { create } from 'zustand'

/**
 * Which cart lines are ticked for checkout. The backend has no select mutation
 * (cart_store always writes selected = 1), so this stays in the browser, keyed
 * by cart_item_id. Lines are selected unless the user unticked them.
 */
const KEY = 'cartpilot.cart.unselected'

function load(): number[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as number[]
  } catch {
    return []
  }
}

interface State {
  unselected: number[]
  toggle: (id: number, on: boolean) => void
  setAll: (ids: number[], on: boolean) => void
}

export const useCartSelection = create<State>((set, get) => {
  const persist = (unselected: number[]) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(unselected))
    } catch {
      /* ignore */
    }
    set({ unselected })
  }
  return {
    unselected: load(),
    toggle: (id, on) => persist(on ? get().unselected.filter((x) => x !== id) : [...new Set([...get().unselected, id])]),
    setAll: (ids, on) => persist(on ? get().unselected.filter((x) => !ids.includes(x)) : [...new Set([...get().unselected, ...ids])]),
  }
})
