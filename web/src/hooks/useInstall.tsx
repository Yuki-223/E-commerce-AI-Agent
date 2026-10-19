import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    listeners.forEach((l) => l())
  })
}

/** 添加到主屏幕: Chrome/Android get the native prompt; iOS Safari only allows the Share-sheet route. */
export function useInstall() {
  const [, tick] = useState(0)
  useEffect(() => {
    const l = () => tick((n) => n + 1)
    listeners.add(l)
    return () => void listeners.delete(l)
  }, [])
  const installed = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true)
  return {
    installed,
    canPrompt: deferred !== null,
    prompt: async () => {
      if (!deferred) return
      await deferred.prompt()
      deferred = null
    },
  }
}

export function InstallHint() {
  return (
    <p className="m-0 rounded-xl bg-surface px-3 py-2 text-xs leading-[18px] text-ink-muted">
      iPhone：在 Safari 里点底部「分享」按钮，选「添加到主屏幕」。安卓 Chrome：点右上角菜单 →「添加到主屏幕」。
    </p>
  )
}
