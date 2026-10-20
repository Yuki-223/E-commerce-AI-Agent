import { useState } from 'react'

/**
 * Pop a count badge when its number changes (count-pop, spring-bounce),
 * never on first render. Spread the result on the badge: the key remounts
 * it per value so each change replays the animation.
 */
export function useBump(value: number) {
  const [last, setLast] = useState(value)
  const [changed, setChanged] = useState(false)
  if (value !== last) {
    setLast(value)
    setChanged(true)
  }
  return { key: value, className: changed ? 'animate-count-pop' : '' }
}
