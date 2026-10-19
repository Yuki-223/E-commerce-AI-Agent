import { useRef } from 'react'

/**
 * Text that grows while the answer streams in. Each newly arrived piece is
 * its own span that fades in from a blur; text present at mount (history)
 * renders plain. If the text is replaced rather than extended, it resets.
 */
export function StreamText({ text }: { text: string }) {
  const seen = useRef({ text, cuts: [text.length] })
  if (text !== seen.current.text) {
    const prev = seen.current
    seen.current = text.startsWith(prev.text) ? { text, cuts: [...prev.cuts, text.length] } : { text, cuts: [text.length] }
  }
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
