/** A product the user attached to a message from the composer's + menu (引用商品). */
export interface ProductRef {
  id: string
  title: string
}

/**
 * The query sent to /chat/stream for a message that references a product.
 * The backend has no field for it, so the product goes into the text with its
 * id, which the agent's product tools accept.
 */
export function withProductRef(text: string, ref: ProductRef | undefined): string {
  const t = text.trim()
  if (!ref) return t
  const head = `关于商品「${ref.title}」（商品 ID：${ref.id}）`
  return t ? `${head}：${t}` : `${head}，介绍一下这款`
}
