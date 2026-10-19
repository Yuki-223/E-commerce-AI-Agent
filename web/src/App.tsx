import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { CartPage } from './pages/CartPage'
import { ChatPage } from './pages/ChatPage'
import { ComparePage } from './pages/ComparePage'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PreferencePage } from './pages/PreferencePage'
import { ProductPage } from './pages/ProductPage'

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="c/:conversationId" element={<ChatPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="p/:productId" element={<ProductPage />} />
        <Route path="settings/preferences" element={<PreferencePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
