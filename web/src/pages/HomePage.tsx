import { useQuery } from '@tanstack/react-query'
import type { ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/endpoints'
import { send } from '../chat/engine'
import type { ProductRef } from '../lib/productRef'
import { CartButton } from '../components/CartButton'
import { Composer } from '../components/chat/Composer'
import { IconCartPilot, IconCup, IconDrop, IconLaptop, IconRunner } from '../components/Icons'
import { MainHeader } from '../components/layout/MainHeader'
import { MenuButton, MobileCartLink, MobileHeader } from '../components/layout/MobileHeader'
import { useIsNarrow } from '../hooks/useIsNarrow'
import { greeting } from '../lib/format'
import { useActiveProfile } from '../stores/profiles'

const FALLBACK_CATEGORIES = ['数码电子', '服饰运动', '美妆护肤', '食品饮料']
const CATEGORY_ICON: Record<string, ComponentType<{ className?: string }>> = {
  数码电子: IconLaptop,
  服饰运动: IconRunner,
  美妆护肤: IconDrop,
  食品饮料: IconCup,
}

/** ⑯ WebHome: serif greeting, the large composer and category shortcuts. */
export function HomePage() {
  const navigate = useNavigate()
  const profile = useActiveProfile()
  const { data } = useQuery({ queryKey: ['suggestions'], queryFn: ({ signal }) => api.suggestions(signal), staleTime: Infinity })
  const narrow = useIsNarrow()
  const categories = data?.categories.length ? data.categories : FALLBACK_CATEGORIES

  const start = (text: string, image?: string, refProduct?: ProductRef) => {
    const id = crypto.randomUUID()
    void send(id, { text, image, refProduct, userId: profile.userId })
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
        <h1 className="m-0 flex items-center justify-center gap-2.5 text-center font-serif text-2xl font-normal leading-tight md:gap-3.5 md:text-[32px]">
          <IconCartPilot className="h-6 w-6 shrink-0 text-primary md:h-8 md:w-8" />
          <span>
            {greeting()}，想买点什么？
          </span>
        </h1>
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
