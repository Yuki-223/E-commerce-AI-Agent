import { Link } from 'react-router-dom'
import type { ChatMessage } from '../../stores/conversations'
import { ProductRefChip } from './ProductRefChip'

export function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="flex flex-col items-end gap-1.5">
      {message.image && <img src={message.image} alt="用户发送的图片" className="h-24 w-24 rounded-[14px] border border-line object-cover" />}
      {message.refProduct && (
        <Link to={`?product=${message.refProduct.id}`} className="max-w-[85%] no-underline md:max-w-[70%]" title="查看商品详情">
          <ProductRefChip productRef={message.refProduct} />
        </Link>
      )}
      {message.text && (
        <div className="max-w-[85%] whitespace-pre-line md:max-w-[70%] break-words rounded-[18px] bg-soft-blue px-4 py-[11px] text-[15px] leading-[22px]">{message.text}</div>
      )}
      {!message.text && message.image && <div className="rounded-[18px] bg-soft-blue px-4 py-[11px] text-[15px] leading-[22px]">拍照找货</div>}
    </div>
  )
}
