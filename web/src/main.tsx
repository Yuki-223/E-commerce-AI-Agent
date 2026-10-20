import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import { bindQueryClient } from './chat/engine'
import { api } from './api/endpoints'
import { hydrateConversations } from './stores/conversations'
import { useAuth } from './stores/auth'
import { hydrateProfiles } from './stores/profiles'
import { initTheme } from './stores/theme'
import './styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
})
bindQueryClient(queryClient)
// Cart, orders and addresses belong to the signed-in account: refetch everything when it changes.
useAuth.subscribe((s, prev) => {
  if (s.token !== prev.token) void queryClient.resetQueries()
})
void hydrateConversations()
void hydrateProfiles()
initTheme()
// Handy in the console during development: await __cartpilotApi.cart()
if (import.meta.env.DEV) (window as unknown as { __cartpilotApi: typeof api }).__cartpilotApi = api

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)

// 添加到主屏幕: register the offline shell in production builds only, so dev HMR is untouched.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined))
}
