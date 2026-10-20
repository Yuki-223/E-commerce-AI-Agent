import type { Product, ProductAttributes, UserPreference } from '../../api/types'
import { usePreference } from '../../hooks/usePreference'
import { useActiveProfile } from '../../stores/profiles'

const PREGNANCY: Record<NonNullable<ProductAttributes['pregnancy']>, string> = { safe: '孕期一般可用', caution: '孕期请遵医嘱', avoid: '孕期不建议' }

/** Reasons this product conflicts with the profile; mirrors search/safety.py violation(). */
export function profileConflicts(a: ProductAttributes, pref: UserPreference | undefined): string[] {
  if (!pref || pref.personalization_enabled === false) return []
  const flags = pref.safety_flags ?? []
  const out: string[] = []
  if (flags.includes('pregnancy') && a.pregnancy === 'avoid') out.push('孕期/哺乳期不建议')
  if (flags.includes('no_caffeine') && a.caffeine) out.push('含咖啡因')
  if (flags.includes('sensitive_skin') && a.fragrance) out.push('含香精')
  if (flags.includes('sensitive_skin') && a.alcohol) out.push('含酒精')
  if (flags.includes('vegan') && a.vegan === false) out.push('含动物来源成分')
  const allergens = (a.allergens ?? []).filter((x) => (pref.allergens_avoid ?? []).includes(x))
  if (allergens.length) out.push(`含过敏原：${allergens.join('、')}`)
  return out
}

/** 成分与安全 on product detail: chips for the attributes plus a warning when the profile conflicts. */
export function SafetyFacts({ product }: { product: Product }) {
  const { data: pref } = usePreference(useActiveProfile().userId)
  const a = product.attributes
  if (!a || !Object.keys(a).length) return null
  const chips = [
    a.pregnancy && PREGNANCY[a.pregnancy],
    a.caffeine === undefined ? null : a.caffeine ? '含咖啡因' : '无咖啡因',
    a.fragrance === undefined ? null : a.fragrance ? '含香精' : '无香精',
    a.vegan ? '纯素' : null,
    (a.allergens ?? []).length ? `过敏原：${a.allergens!.join('、')}` : '无常见过敏原',
  ].filter((c): c is string => Boolean(c))
  const conflicts = profileConflicts(a, pref)
  return (
    <section aria-label="成分与安全" className="flex flex-col gap-2 rounded-[14px] border border-line p-3">
      <h3 className="m-0 text-xs font-semibold text-primary-text">成分与安全</h3>
      {conflicts.length > 0 && (
        <p role="alert" className="m-0 rounded-lg bg-[color-mix(in_srgb,var(--error)_10%,transparent)] px-2.5 py-1.5 text-[13px] text-error-text">
          与你的档案不符：{conflicts.join('；')}
        </p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span key={c} className="rounded-full bg-secondary px-2.5 py-1 text-xs text-ink-muted">
            {c}
          </span>
        ))}
      </div>
      {a.ingredients?.length ? <p className="m-0 text-xs leading-[18px] text-ink-subtle">主要成分：{a.ingredients.join('、')}</p> : null}
      {a.pregnancy_note && a.pregnancy !== 'safe' ? <p className="m-0 text-xs leading-[18px] text-ink-subtle">{a.pregnancy_note}。</p> : null}
    </section>
  )
}
