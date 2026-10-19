import { useEffect } from 'react'

export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · CartPilot` : 'CartPilot · 购物导购'
  }, [title])
}
