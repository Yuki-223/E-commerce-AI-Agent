import { useState } from 'react'

/** Product photo with a quiet placeholder when the URL is missing or fails. */
export function ProductImage({ src, alt, className = '', fit = 'contain' }: { src: string | null; alt: string; className?: string; fit?: 'contain' | 'cover' }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-field text-xs text-ink-subtle ${className}`} role="img" aria-label={alt}>
        暂无图片
      </div>
    )
  }
  return <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`bg-white ${fit === 'contain' ? 'object-contain' : 'object-cover'} ${className}`} />
}
