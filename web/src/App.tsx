import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { CartPage } from './pages/CartPage'
import { ChatPage } from './pages/ChatPage'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="c/:conversationId" element={<ChatPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
