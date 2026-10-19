import { useQuery } from '@tanstack/react-query'
import type { ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/endpoints'
import { send } from '../chat/engine'
import { CartButton } from '../components/CartButton'
import { Composer } from '../components/chat/Composer'
import { IconCup, IconDrop, IconLaptop, IconRunner } from '../components/Icons'
import { MainHeader } from '../components/layout/MainHeader'
import { MenuButton, MobileCartLink, MobileHeader } from '../components/layout/MobileHeader'
import { useIsNarrow } from '../hooks/useIsNarrow'
import { useActiveProfile } from '../stores/profiles'

const FALLBACK_CATEGORIES = ['数码电子', '服饰运动', '美妆护肤', '食品饮料']
const CATEGORY_ICON: Record<string, ComponentType<{ className?: string }>> = {
  数码电子: IconLaptop,
  服饰运动: IconRunner,
  美妆护肤: IconDrop,
  食品饮料: IconCup,
}

/** ⑯ WebHome: empty state with category shortcuts and the large composer. */
export function HomePage() {
  const navigate = useNavigate()
  const profile = useActiveProfile()
  const { data } = useQuery({ queryKey: ['suggestions'], queryFn: ({ signal }) => api.suggestions(signal), staleTime: Infinity })
  const narrow = useIsNarrow()
  const categories = data?.categories.length ? data.categories : FALLBACK_CATEGORIES

  const start = (text: string, image?: string) => {
    const id = crypto.randomUUID()
    void send(id, { text, image, userId: profile.userId })
    navigate(`/c/${id}`)
  }

  return (
    <>
      {narrow ? (
        <MobileHeader left={<MenuButton />} right={<MobileCartLink />}>
          <span className="font-logo text-xl leading-[1.1] tracking-[0.3px]">CartPilot</span>
        </MobileHeader>
      ) : (
        <MainHeader bordered={false}>
          <CartButton />
        </MainHeader>
      )}
      <div className="flex grow flex-col items-center justify-center gap-6 overflow-y-auto px-4 pb-[max(24px,env(safe-area-inset-bottom))] md:gap-7 md:px-10 md:pb-20">
        <div className="flex flex-col items-center gap-2.5 text-center">
          <h1 className="m-0 text-[26px] font-bold md:text-[34px]">想找点什么</h1>
          <p className="m-0 text-sm text-ink-muted md:text-base">直接说需求，拖入或粘贴商品图片，或选个分类</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {categories.map((c) => {
            const Icon = CATEGORY_ICON[c] ?? IconLaptop
            return (
              <button
                key={c}
                type="button"
                onClick={() => start(`推荐${c}`)}
                className="flex h-11 items-center gap-2.5 rounded-full border border-line-strong bg-surface px-4 text-[15px] md:px-5 text-ink hover:border-primary"
              >
                <Icon className="text-ink-subtle" />
                {c}
              </button>
            )
          })}
        </div>
        <Composer variant="home" onSend={start} />
        <div className="hidden text-xs text-ink-subtle md:block">支持 JPG / PNG · 也可以直接把图片拖到这个窗口</div>
      </div>
    </>
  )
}
