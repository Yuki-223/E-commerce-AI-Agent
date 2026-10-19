import { CartButton } from '../components/CartButton'
import { MainHeader } from '../components/layout/MainHeader'

export function HomePage() {
  return (
    <>
      <MainHeader bordered={false}>
        <CartButton />
      </MainHeader>
      <div className="flex grow flex-col items-center justify-center gap-2.5 pb-20">
        <h1 className="m-0 text-[34px] font-bold">想找点什么</h1>
        <p className="m-0 text-base text-ink-muted">直接说需求，拖入或粘贴商品图片，或选个分类</p>
      </div>
    </>
  )
}
