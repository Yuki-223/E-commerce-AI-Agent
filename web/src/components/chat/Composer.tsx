import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useSpeech } from '../../hooks/useSpeech'
import { compressImage, firstImage, IMAGE_ACCEPT } from '../../lib/image'
import { IconClose, IconImage, IconMic, IconPlus, IconSend, IconStop } from '../Icons'

export interface ComposerHandle {
  setText: (text: string) => void
  focus: () => void
}

interface Props {
  variant: 'home' | 'chat'
  busy?: boolean
  disabled?: boolean
  onSend: (text: string, image?: string) => void
  onStop?: () => void
  /** Lets the page push a follow-up chip into the input. */
  handleRef?: (h: ComposerHandle) => void
  placeholder?: string
}

/**
 * Text + image + voice input. Images arrive by the upload button, paste anywhere
 * on the page, or drag-and-drop onto the window (WebHome ⑯).
 */
export function Composer({ variant, busy, disabled, onSend, onStop, handleRef, placeholder }: Props) {
  const [text, setText] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [imageSource, setImageSource] = useState<'粘贴' | '拖入' | '选择'>('选择')
  const [dragging, setDragging] = useState(false)
  const [imageError, setImageError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const speechBase = useRef('')
  const speech = useSpeech(useCallback((t: string) => setText(speechBase.current + t), []))

  useEffect(() => {
    handleRef?.({
      setText: (t) => {
        setText(t)
        requestAnimationFrame(() => inputRef.current?.focus())
      },
      focus: () => inputRef.current?.focus(),
    })
  }, [handleRef])

  const attach = useCallback(async (file: File | null, source: '粘贴' | '拖入' | '选择') => {
    if (!file) return
    try {
      setImageError('')
      setImage(await compressImage(file))
      setImageSource(source)
      inputRef.current?.focus()
    } catch {
      setImageError('这张图片无法读取，换一张 JPG 或 PNG 试试')
    }
  }, [])

  // Paste and drop work anywhere on the page while this composer is mounted.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = firstImage(e.clipboardData?.items)
      if (file) {
        e.preventDefault()
        void attach(file, '粘贴')
      }
    }
    let depth = 0
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth += 1
      setDragging(true)
    }
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setDragging(false)
    }
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDragging(false)
      void attach(firstImage(e.dataTransfer?.files), '拖入')
    }
    window.addEventListener('paste', onPaste)
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('dragover', onOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('paste', onPaste)
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [attach])

  // Grow the textarea with its content up to ~5 lines.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`
  }, [text])

  const canSend = !busy && !disabled && (text.trim().length > 0 || image !== null)

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    if (!canSend) return
    if (speech.listening) speech.stop()
    onSend(text.trim(), image ?? undefined)
    setText('')
    setImage(null)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  const toggleMic = () => {
    if (speech.listening) return speech.stop()
    speechBase.current = text ? `${text} ` : ''
    speech.start()
  }

  const home = variant === 'home'
  const btn = home ? 'h-10 w-10' : 'h-9 w-9'

  return (
    <>
      <form
        onSubmit={submit}
        className={
          home
            ? 'flex w-full max-w-[760px] flex-col gap-2.5 rounded-3xl border border-line-strong bg-surface p-3 shadow-[0_8px_28px_rgba(43,30,18,0.08)]'
            : 'flex flex-col gap-2 rounded-[22px] border border-line-strong bg-surface px-2.5 py-2 shadow-input focus-within:border-primary'
        }
      >
        {image && (
          <div className="flex items-center gap-3 p-1">
            <div className="relative shrink-0">
              <img src={image} alt="待发送的图片" className="h-16 w-16 rounded-xl border border-line-strong object-cover" />
              <button
                type="button"
                aria-label="移除图片"
                onClick={() => setImage(null)}
                className="absolute -right-2 -top-2 flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-surface bg-ink p-0 text-bg"
              >
                <IconClose size={8} strokeWidth={2.2} />
              </button>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] font-semibold">已{imageSource === '选择' ? '添加' : imageSource} 1 张图片</span>
              <span className="text-xs text-ink-subtle">发送后会先识别图片，再为你匹配商品</span>
            </div>
          </div>
        )}
        <div className={`flex items-center ${home ? 'gap-2.5' : 'gap-2.5'}`}>
          <button
            type="button"
            aria-label="上传图片"
            onClick={() => fileRef.current?.click()}
            className={`flex ${btn} shrink-0 items-center justify-center rounded-full p-0 ${home ? 'bg-soft-purple text-primary-text' : 'bg-primary text-white'}`}
          >
            {home ? <IconImage /> : <IconPlus />}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={IMAGE_ACCEPT}
            hidden
            onChange={(e) => {
              void attach(e.target.files?.[0] ?? null, '选择')
              e.target.value = ''
            }}
          />
          <label htmlFor={`composer-${variant}`} className="sr-only-label">
            输入需求
          </label>
          <textarea
            id={`composer-${variant}`}
            ref={inputRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder ?? (home ? '说说你想买什么，比如「500 元以内不含酒精的防晒」' : '继续追问，或把商品图片拖进来 / 直接粘贴截图')}
            className={`min-w-0 grow resize-none bg-transparent px-1 leading-[22px] text-ink outline-none placeholder:text-ink-subtle focus-visible:outline-none ${home ? 'text-base' : 'text-[15px]'}`}
          />
          {speech.supported && (
            <button
              type="button"
              aria-label={speech.listening ? '停止语音输入' : '语音输入'}
              aria-pressed={speech.listening}
              onClick={toggleMic}
              className={`flex ${btn} shrink-0 items-center justify-center rounded-full p-0 ${speech.listening ? 'bg-primary-tint text-primary-text' : 'bg-transparent text-ink-subtle'}`}
            >
              <IconMic />
            </button>
          )}
          {busy && onStop ? (
            <button type="button" aria-label="停止生成" onClick={onStop} className={`flex ${btn} shrink-0 items-center justify-center rounded-full bg-ink p-0 text-bg`}>
              <IconStop />
            </button>
          ) : (
            <button
              type="submit"
              aria-label="发送"
              disabled={!canSend}
              className={`flex ${btn} shrink-0 items-center justify-center rounded-full p-0 text-white ${canSend ? 'bg-primary' : 'bg-disabled'}`}
            >
              <IconSend size={home ? 17 : 16} />
            </button>
          )}
        </div>
        {imageError && <p className="m-0 px-1 text-xs text-error-text">{imageError}</p>}
      </form>
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-[rgba(251,250,247,0.82)]">
          <div className="rounded-3xl border-2 border-dashed border-primary bg-surface px-10 py-8 text-center shadow-pop">
            <IconImage size={32} className="mx-auto mb-2 text-primary-text" />
            <div className="text-base font-semibold">松开即可添加图片</div>
            <div className="mt-1 text-xs text-ink-subtle">支持 JPG / PNG</div>
          </div>
        </div>
      )}
    </>
  )
}
