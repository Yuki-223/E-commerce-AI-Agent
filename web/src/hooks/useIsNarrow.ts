import { useSyncExternalStore } from 'react'

/** Phone layout below 768 px (MWeb* artboards). Desktop and narrow share routes. */
const QUERY = '(max-width: 767px)'
const mql = typeof window !== 'undefined' ? window.matchMedia(QUERY) : null

export function useIsNarrow(): boolean {
  return useSyncExternalStore(
    (cb) => {
      mql?.addEventListener('change', cb)
      return () => mql?.removeEventListener('change', cb)
    },
    () => Boolean(mql?.matches),
    () => false,
  )
}
