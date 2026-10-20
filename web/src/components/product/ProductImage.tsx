import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Product photo. `src` undefined means the product is still loading: a plain
 * field-coloured block, no text. null (or a failed load) is 暂无图片. A photo
 * fades in over dur-base once it has loaded, unless it was already cached.
 */
export function ProductImage({ src, alt, className = '', fit = 'contain' }: { src: string | null | undefined; alt: string; className?: string; fit?: 'contain' | 'cover' }) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const img = useRef<HTMLImageElement>(null)
  const [shown, setShown] = useState(src)
  if (src !== shown) {
    setShown(src)
    setLoaded(false)
    setFailed(false)
  }
  // A cached photo is complete before paint: show it at once instead of fading.
  useLayoutEffect(() => {
    if (img.current?.complete && img.current.naturalWidth) setLoaded(true)
  }, [src])

  if (src === undefined) return <div className={`bg-field ${className}`} role="img" aria-label={alt} aria-busy="true" />
  if (!src || failed) {
    return (
      // Thumbnails too narrow for the words (order receipt, spec card) stay a plain block.
      <div className={`flex items-center justify-center bg-field text-xs text-ink-subtle [container-type:inline-size] ${className}`} role="img" aria-label={alt}>
        <span className="whitespace-nowrap [@container(max-width:63px)]:hidden">暂无图片</span>
      </div>
    )
  }
  return (
    <span className={`block overflow-hidden bg-field ${className}`}>
      <img
        ref={img}
        key={src}
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`h-full w-full bg-white transition-opacity duration-base ease-out ${fit === 'contain' ? 'object-contain' : 'object-cover'} ${loaded ? '' : 'opacity-0'}`}
      />
    </span>
  )
}
