import { useEffect } from 'react'

export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · CartPilot` : 'CartPilot · 她的补给站'
  }, [title])
}
