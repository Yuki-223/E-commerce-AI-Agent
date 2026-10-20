/**
 * Pick SKU options that fit the body profile; mirrors backend/store/sku_match.py.
 */
import type { UserPreference } from '../api/types'

const TONE_WORDS: Record<string, string[]> = { cool: ['冷'], neutral: ['自然'], warm: ['暖', '小麦', '健康'] }

function shoeFits(value: string, shoe: string): boolean {
  if (!/^\d+$/.test(shoe)) return false
  const span = /^(\d{2})\s*-\s*(\d{2})$/.exec(value.trim())
  if (span) return Number(span[1]) <= Number(shoe) && Number(shoe) <= Number(span[2])
  return value.trim() === shoe
}

export function suggestOption(dimension: string, values: string[], pref: UserPreference | undefined): string | null {
  const body = pref?.body_profile
  if (!body) return null
  let matches: string[] = []
  if (dimension.includes('码')) {
    const clothing = (body.clothing_size ?? '').toUpperCase()
    const bra = (body.bra_size ?? '').toUpperCase()
    const shoe = body.shoe_size ?? ''
    matches = values.filter((v) => {
      const head = v.split('（')[0].trim().toUpperCase()
      return (bra && head === bra) || (clothing && head === clothing) || (shoe && shoeFits(head, shoe))
    })
  } else if (dimension.includes('色号')) {
    const words = TONE_WORDS[body.skin_tone ?? ''] ?? []
    matches = values.filter((v) => words.some((w) => v.includes(w)))
  }
  return matches.length === 1 ? matches[0] : null
}

/** `{dimension: value}` for every dimension the profile decides. */
export function suggestOptions(dimensions: Record<string, string[]>, pref: UserPreference | undefined): Record<string, string> {
  if (!pref || pref.personalization_enabled === false) return {}
  const out: Record<string, string> = {}
  for (const [dim, values] of Object.entries(dimensions)) {
    const choice = suggestOption(dim, values, pref)
    if (choice) out[dim] = choice
  }
  return out
}
