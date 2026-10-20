import { beforeEach, describe, expect, it } from 'vitest'
import { parseProps, propsText } from '../pages/merchant/ProductEditor'
import { catalog } from './catalog'
import { mockFetch } from './server'

const post = (path: string, body: unknown, token?: string) =>
  mockFetch(path, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: JSON.stringify(body),
  })
const get = (path: string, token?: string) => mockFetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} })

// Mirrors backend/api/tests/test_commerce.py for the endpoints the web client calls.
describe('mock commerce endpoints', () => {
  beforeEach(() => localStorage.clear())

  it('registers, places an order to the default address and walks it to completion', async () => {
    const { token } = await (await post('/auth/register', { username: 'alice', password: 'secret123', role: 'customer' })).json()
    expect((await post('/auth/login', { username: 'alice', password: 'nope' })).status).toBe(401)
    await post('/addresses', { recipient: '小爱', phone: '13800000000', region: '', detail: '示例路 2 号', is_default: false }, token)

    const placed = await (await post('/orders', { items: [{ productID: catalog[0].product_id, skuID: null, quantity: 2 }] }, token)).json()
    expect(placed.order.status).toBe('pending_payment')
    expect(placed.order.address).toContain('小爱')

    const id = placed.order.order_id
    const listed = await (await get('/orders', token)).json()
    expect(listed.orders.map((o: { order_id: string }) => o.order_id)).toEqual([id])
    expect((await get('/orders')).status).toBe(200)
    expect((await (await get('/orders')).json()).orders).toEqual([]) // the demo shopper sees none of alice's

    expect((await post(`/orders/${id}/confirm`, {}, token)).status).toBe(409)
    expect((await (await post(`/orders/${id}/pay`, {}, token)).json()).order.status).toBe('paid')
    const refund = await (await post(`/orders/${id}/refund`, { reason: '不想要了' }, token)).json()
    expect(refund.order.status_label).toBe('退款中')
  })

  it('keeps the merchant console behind a merchant account', async () => {
    const shopper = (await (await post('/auth/register', { username: 'bob', password: 'secret123', role: 'customer' })).json()).token
    expect((await get('/merchant/products', shopper)).status).toBe(403)
    expect((await get('/merchant/products')).status).toBe(401)

    const shop = (await (await post('/auth/register', { username: 'shop', password: 'secret123', role: 'merchant', shop_name: '小店' })).json()).token
    const created = await (
      await post(
        '/merchant/products',
        { title: '帆布包', brand: '小店', category: '服饰运动', sub_category: '', image_url: 'https://img/bag.jpg', description: '', skus: [{ properties: { 颜色: '米白' }, price: 59, stock_qty: 4 }] },
        shop,
      )
    ).json()
    expect(created.product.total_stock).toBe(4)
    const stats = await (await get('/merchant/stats', shop)).json()
    expect(stats.low_stock).toHaveLength(1)
  })
})

describe('SKU property text', () => {
  it('round-trips and accepts full-width separators', () => {
    expect(parseProps('颜色：黑，尺码=M')).toEqual({ 颜色: '黑', 尺码: 'M' })
    expect(parseProps(propsText({ 容量: '30ml' }))).toEqual({ 容量: '30ml' })
    expect(parseProps('无效, :x')).toEqual({})
  })
})
