import { useState } from 'react'

/**
 * Replay an entrance when `value` changes, never on first render: by default
 * a count badge's pop (count-pop, spring-bounce). Put `key` and `className`
 * on the element; the key remounts it per value so each change replays.
 */
export function useBump<T extends string | number | boolean>(value: T, animation = 'animate-count-pop') {
  const [last, setLast] = useState(value)
  const [changed, setChanged] = useState(false)
  if (value !== last) {
    setLast(value)
    setChanged(true)
  }
  return { key: String(value), className: changed ? animation : '' }
}
