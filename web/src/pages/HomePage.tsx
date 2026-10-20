import { useNavigate } from 'react-router-dom'
import { send } from '../chat/engine'
import type { ProductRef } from '../lib/productRef'
import { CartButton } from '../components/CartButton'
import { Composer } from '../components/chat/Composer'
import { CycleCard } from '../components/chat/CycleCard'
import { ProfilePicker } from '../components/chat/ProfilePicker'
import { IconCartPilot } from '../components/Icons'
import { MainHeader } from '../components/layout/MainHeader'
import { MenuButton, MobileCartLink, MobileHeader } from '../components/layout/MobileHeader'
import { useIsNarrow } from '../hooks/useIsNarrow'
import { greeting } from '../lib/format'
import { useActiveProfile } from '../stores/profiles'

/** Scenario shortcuts: each sends a ready-made request into a new conversation. */
const SCENARIOS: { label: string; prompt: string }[] = [
  { label: '经期关怀', prompt: '经期也想照常训练，推荐合适的经期用品和补给' },
  { label: '训练补给', prompt: '每周跑步三次，推荐训练前后的补给' },
  { label: '备孕孕期', prompt: '我在备孕，推荐孕期也能放心用的营养素' },
  { label: '补铁补钙', prompt: '经常乏力，推荐温和补铁的营养素' },
  { label: '敏感肌运动护理', prompt: '敏感肌，推荐无香精的运动防晒和洁面' },
  { label: '控糖轻食', prompt: '推荐低糖高蛋白的加餐零食' },
]
/** Touch screens get 44px-tall hit areas for the small text links. */
const LINK = 'h-8 [@media(pointer:coarse)]:h-11'

/** ⑯ WebHome: serif greeting, the large composer, the profile picker and scenario shortcuts, then the 经期关怀 card. */
export function HomePage() {
  const navigate = useNavigate()
  const profile = useActiveProfile()
  const narrow = useIsNarrow()

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
        <div className="flex flex-col items-center gap-2">
          <h1 className="m-0 flex items-center justify-center gap-2.5 text-center font-serif text-2xl font-normal leading-tight md:gap-3.5 md:text-[32px]">
            <IconCartPilot className="h-6 w-6 shrink-0 text-primary md:h-8 md:w-8" />
            <span>
              {greeting()}，今天想补给点什么？
            </span>
          </h1>
          <p className="m-0 text-center text-[13px] text-ink-muted md:text-sm">说说你的训练、周期或身体状况，我按成分和场景帮你挑。</p>
        </div>
        <div className="flex w-full max-w-[760px] flex-col gap-3">
          <Composer variant="home" onSend={start} />
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-1">
            <ProfilePicker className={LINK} />
            <nav aria-label="按场景推荐" className="flex flex-wrap items-center gap-1.5">
              {SCENARIOS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  title={s.prompt}
                  onClick={() => start(s.prompt)}
                  className={`${LINK} rounded-full border border-line-strong bg-surface px-3 text-[13px] text-ink-muted hover:border-primary hover:text-primary-text`}
                >
                  {s.label}
                </button>
              ))}
            </nav>
          </div>
          <CycleCard onPrompt={start} />
        </div>
      </div>
    </>
  )
}
