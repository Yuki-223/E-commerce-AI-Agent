import { Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { CartPage } from './pages/CartPage'
import { ChatPage } from './pages/ChatPage'
import { ComparePage } from './pages/ComparePage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { MerchantPage } from './pages/merchant/MerchantPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { OrdersPage } from './pages/OrdersPage'
import { ProductPage } from './pages/ProductPage'
import { SettingsRedirect } from './pages/settings/SettingsLayout'

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="c/:conversationId" element={<ChatPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="merchant" element={<MerchantPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="p/:productId" element={<ProductPage />} />
        <Route path="settings/:tab?" element={<SettingsRedirect />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
