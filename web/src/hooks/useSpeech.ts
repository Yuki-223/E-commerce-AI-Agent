import { useCallback, useEffect, useRef, useState } from 'react'

/* Web Speech API is still prefixed in Safari/Chrome and absent from lib.dom. */
interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start(): void
  stop(): void
}

type Ctor = new () => SpeechRecognitionLike

function recognitionCtor(): Ctor | null {
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** zh-CN dictation. `supported` is false where the API is missing, and the mic button hides. */
export function useSpeech(onText: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const rec = useRef<SpeechRecognitionLike | null>(null)
  const supported = typeof window !== 'undefined' && recognitionCtor() !== null

  const stop = useCallback(() => rec.current?.stop(), [])

  const start = useCallback(() => {
    const C = recognitionCtor()
    if (!C) return
    const r = new C()
    r.lang = 'zh-CN'
    r.interimResults = true
    r.continuous = false
    r.onresult = (e) => {
      const text = Array.from(e.results).map((res) => res[0]?.transcript ?? '').join('')
      onText(text)
    }
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    rec.current = r
    setListening(true)
    r.start()
  }, [onText])

  useEffect(() => () => rec.current?.stop(), [])
  return { supported, listening, start, stop }
}
