import { useEffect, useRef, useState } from 'react'

/** Long enough for the last piece's 90ms reveal to finish. */
const SETTLE_MS = 100

/**
 * Text that grows while the answer streams in. Each newly arrived piece is
 * its own span that sharpens out of a blur (Grapheme Reveal); text present at
 * mount (history) renders plain. Once `done`, the pieces fold back into one
 * text node, so a finished answer leaves no per-piece spans behind. If the
 * text is replaced rather than extended, it resets.
 */
export function StreamText({ text, done = false }: { text: string; done?: boolean }) {
  const seen = useRef({ text, cuts: [text.length] })
  if (text !== seen.current.text) {
    const prev = seen.current
    seen.current = text.startsWith(prev.text) ? { text, cuts: [...prev.cuts, text.length] } : { text, cuts: [text.length] }
  }
  const [, settle] = useState(0)
  useEffect(() => {
    if (!done || seen.current.cuts.length < 2) return
    const t = window.setTimeout(() => {
      seen.current = { text: seen.current.text, cuts: [seen.current.text.length] }
      settle((n) => n + 1)
    }, SETTLE_MS)
    return () => window.clearTimeout(t)
  }, [done, text])
  const { cuts } = seen.current
  return (
    <>
      {text.slice(0, cuts[0])}
      {cuts.slice(1).map((end, i) => (
        <span key={cuts[i]} className="animate-reveal">
          {text.slice(cuts[i], end)}
        </span>
      ))}
    </>
  )
}
