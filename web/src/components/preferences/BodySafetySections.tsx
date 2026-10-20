import type { BodyProfile, SafetyFlag, UserPreference } from '../../api/types'
import { Row, Section, Switch } from '../../pages/settings/ui'
import { Segmented } from '../Segmented'

const SKIN_TYPES: [string, string][] = [['干性', '干性'], ['中性', '中性'], ['油性', '油性'], ['混合', '混合'], ['敏感', '敏感']]
const SKIN_TONES: [NonNullable<BodyProfile['skin_tone']>, string][] = [['cool', '冷调'], ['neutral', '自然'], ['warm', '暖调']]
const CLOTHING = ['XS', 'S', 'M', 'L', 'XL']
const BRA = ['70A', '70B', '75A', '75B', '75C', '80B', '80C', '85C']
const SHOES = ['35', '36', '37', '38', '39', '40']
/** search/safety.py SAFETY_FLAGS and ALLERGENS. */
const SAFETY: { flag: SafetyFlag; label: string; hint: string }[] = [
  { flag: 'pregnancy', label: '孕期 / 备孕 / 哺乳期', hint: '不推荐标注为孕期不建议的商品，例如肌酸、暖宫贴、内置式经期用品' },
  { flag: 'sensitive_skin', label: '敏感肌', hint: '避开含香精或酒精的商品' },
  { flag: 'no_caffeine', label: '不碰咖啡因', hint: '避开含咖啡因的饮品、能量胶和零食' },
  { flag: 'vegan', label: '纯素', hint: '避开乳清、鱼油、胶原蛋白等动物来源成分' },
]
const ALLERGENS = ['乳制品', '大豆', '坚果', '麸质', '鱼']

const SELECT = 'h-9 rounded-lg border border-line-strong bg-surface px-2.5 text-sm text-ink outline-none focus:border-primary'

function SizeSelect({ label, value, options, onChange }: { label: string; value?: string; options: string[]; onChange: (v: string | undefined) => void }) {
  return (
    <select aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} className={SELECT}>
      <option value="">未填写</option>
      {options.map((o) => (
        <option key={o}>{o}</option>
      ))}
    </select>
  )
}

/**
 * 身体与肤质档案 + 成分与安全, two sections of the 购物偏好 tab. Sizes and skin tone
 * preselect SKUs; safety switches and allergens hard-filter recommendations.
 */
export function BodySafetySections({ pref, mutate }: { pref: UserPreference; mutate: (edit: (p: UserPreference) => UserPreference) => void }) {
  const body = pref.body_profile ?? {}
  const flags = pref.safety_flags ?? []
  const allergens = pref.allergens_avoid ?? []
  const setBody = (patch: Partial<BodyProfile>) => mutate((p) => ({ ...p, body_profile: { ...(p.body_profile ?? {}), ...patch } }))
  const toggleFlag = (flag: SafetyFlag, on: boolean) =>
    mutate((p) => {
      const rest = (p.safety_flags ?? []).filter((f) => f !== flag)
      return { ...p, safety_flags: on ? [...rest, flag] : rest }
    })

  return (
    <>
      <Section title="身体与肤质档案" description="选规格时自动帮你预选尺码和色号，推荐理由也会参考这里。">
        <Row label="肤质" wide>
          <Segmented label="肤质" size="sm" options={SKIN_TYPES} value={body.skin_type ?? ''} onChange={(v) => setBody({ skin_type: v })} />
        </Row>
        <Row label="肤色冷暖" hint="看手腕静脉：偏紫蓝是冷调，偏绿是暖调" wide>
          <Segmented label="肤色冷暖" size="sm" options={SKIN_TONES} value={body.skin_tone ?? ('' as 'cool')} onChange={(v) => setBody({ skin_tone: v })} />
        </Row>
        <Row label="尺码" hint="服装 / 运动内衣 / 鞋" wide>
          <div className="flex flex-wrap gap-2">
            <SizeSelect label="常穿服装尺码" value={body.clothing_size} options={CLOTHING} onChange={(v) => setBody({ clothing_size: v })} />
            <SizeSelect label="运动内衣尺码" value={body.bra_size} options={BRA} onChange={(v) => setBody({ bra_size: v })} />
            <SizeSelect label="鞋码" value={body.shoe_size} options={SHOES} onChange={(v) => setBody({ shoe_size: v })} />
          </div>
        </Row>
      </Section>

      <Section title="成分与安全" description="打开后，推荐结果会直接排除不合适的商品。这些信息只用于筛选，不会从对话里自动记录。">
        {SAFETY.map(({ flag, label, hint }) => (
          <Row key={flag} label={label} hint={hint}>
            <Switch label={label} checked={flags.includes(flag)} onChange={(on) => toggleFlag(flag, on)} />
          </Row>
        ))}
        <Row label="过敏或不吃的成分" hint="点选后会避开含这些成分的商品" stacked>
          <div className="flex flex-wrap gap-2">
            {ALLERGENS.map((a) => {
              const on = allergens.includes(a)
              return (
                <button
                  key={a}
                  type="button"
                  aria-pressed={on}
                  onClick={() => mutate((p) => ({ ...p, allergens_avoid: on ? allergens.filter((x) => x !== a) : [...allergens, a] }))}
                  className={`h-9 rounded-lg border px-3.5 text-sm ${on ? 'border-primary bg-primary-soft font-medium text-primary-text' : 'border-line-strong bg-surface text-ink'}`}
                >
                  {a}
                </button>
              )
            })}
          </div>
        </Row>
      </Section>
    </>
  )
}
