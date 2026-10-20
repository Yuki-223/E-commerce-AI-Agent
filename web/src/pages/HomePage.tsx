import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/endpoints'
import { send } from '../chat/engine'
import type { ProductRef } from '../lib/productRef'
import { CartButton } from '../components/CartButton'
import { Composer } from '../components/chat/Composer'
import { ProfilePicker } from '../components/chat/ProfilePicker'
import { IconCartPilot } from '../components/Icons'
import { MainHeader } from '../components/layout/MainHeader'
import { MenuButton, MobileCartLink, MobileHeader } from '../components/layout/MobileHeader'
import { useIsNarrow } from '../hooks/useIsNarrow'
import { greeting } from '../lib/format'
import { useActiveProfile } from '../stores/profiles'

const FALLBACK_CATEGORIES = ['数码电子', '服饰运动', '美妆护肤', '食品饮料']
/** Touch screens get 44px-tall hit areas for the small text links. */
const LINK = 'h-8 [@media(pointer:coarse)]:h-11'

/** ⑯ WebHome: serif greeting, the large composer, then a profile picker and category links under it. */
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
        <div className="flex w-full max-w-[760px] flex-col gap-2">
          <Composer variant="home" onSend={start} />
          <div className="flex items-center justify-between gap-3 px-1">
            <ProfilePicker className={LINK} />
            <nav aria-label="按分类推荐" className="flex shrink-0 items-center text-[13px] text-ink-subtle">
              {categories.map((c, i) => (
                <span key={c} className="flex items-center">
                  {i > 0 && <span aria-hidden="true">·</span>}
                  <button
                    type="button"
                    title={`推荐${c}`}
                    onClick={() => start(`推荐${c}`)}
                    className={`${LINK} rounded-md bg-transparent px-1.5 text-ink-muted hover:text-ink hover:underline hover:underline-offset-4`}
                  >
                    {c.slice(0, 2)}
                  </button>
                </span>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </>
  )
}
