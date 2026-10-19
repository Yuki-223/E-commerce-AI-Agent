import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import { bindQueryClient } from './chat/engine'
import { api } from './api/endpoints'
import { hydrateConversations } from './stores/conversations'
import './styles/index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
})
bindQueryClient(queryClient)
void hydrateConversations()
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
