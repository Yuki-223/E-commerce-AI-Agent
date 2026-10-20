import { useCallback, useEffect, useState, type AnimationEvent } from 'react'

/** Fallback unmount in case animationend never arrives (element hidden, animation removed). */
const FALLBACK_MS = 400

export type PresenceState = 'open' | 'closed'
export interface PresenceProps {
  'data-state': PresenceState
  onAnimationEnd: (e: AnimationEvent) => void
}

/**
 * Keeps an overlay mounted while it plays its exit. Mounts synchronously on
 * open; on close it sets data-state="closed" (style it with the `closing:`
 * variant) and unmounts when that element's own animation ends. Callers run
 * their action first and close second, so nothing waits on the animation.
 */
export function usePresence(open: boolean) {
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)

  useEffect(() => {
    if (open || !mounted) return
    const t = window.setTimeout(() => setMounted(false), FALLBACK_MS)
    return () => window.clearTimeout(t)
  }, [open, mounted])

  const onAnimationEnd = useCallback(
    (e: AnimationEvent) => {
      if (!open && e.target === e.currentTarget) setMounted(false)
    },
    [open],
  )

  const state: PresenceState = open ? 'open' : 'closed'
  return { mounted: open || mounted, state, onAnimationEnd, props: { 'data-state': state, onAnimationEnd } satisfies PresenceProps }
}

interface Entry<T> {
  key: string
  item: T
  leaving: boolean
}

function merge<T>(prev: Entry<T>[], items: T[], keyOf: (item: T) => string): Entry<T>[] {
  const next = new Map(items.map((item) => [keyOf(item), item]))
  const known = new Set(prev.map((e) => e.key))
  const out: Entry<T>[] = []
  let i = 0
  const flushNew = (until?: string) => {
    for (; i < items.length; i++) {
      const k = keyOf(items[i])
      if (k === until) return
      if (!known.has(k)) out.push({ key: k, item: items[i], leaving: false })
    }
  }
  for (const e of prev) {
    const item = next.get(e.key)
    if (item === undefined) {
      out.push({ ...e, leaving: true })
      continue
    }
    flushNew(e.key)
    out.push({ key: e.key, item, leaving: false })
    i++
  }
  flushNew()
  return out
}

/**
 * usePresence for lists: items removed from `items` stay in place with
 * data-state="closed" until their exit animation ends, so the rows below
 * close up smoothly instead of jumping. The removal itself is not delayed;
 * leaving rows are inert (pointer-events: none).
 */
export function usePresenceList<T>(items: T[], keyOf: (item: T) => string) {
  const [state, setState] = useState(() => ({ src: items, list: items.map((item) => ({ key: keyOf(item), item, leaving: false })) }))
  let list = state.list
  if (state.src !== items) {
    list = merge(state.list, items, keyOf)
    setState({ src: items, list })
  }

  const drop = useCallback((keys: string[]) => {
    setState((s) => ({ ...s, list: s.list.filter((e) => !(e.leaving && keys.includes(e.key))) }))
  }, [])

  const leavingKeys = list.filter((e) => e.leaving).map((e) => e.key).join('\n')
  useEffect(() => {
    if (!leavingKeys) return
    const t = window.setTimeout(() => drop(leavingKeys.split('\n')), FALLBACK_MS)
    return () => window.clearTimeout(t)
  }, [leavingKeys, drop])

  return list.map((e) => ({
    key: e.key,
    item: e.item,
    leaving: e.leaving,
    props: {
      'data-state': (e.leaving ? 'closed' : 'open') as PresenceState,
      onAnimationEnd: (ev: AnimationEvent) => {
        if (e.leaving && ev.target === ev.currentTarget) drop([e.key])
      },
    } satisfies PresenceProps,
  }))
}
