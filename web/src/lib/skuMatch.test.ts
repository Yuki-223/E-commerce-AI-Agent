import { describe, expect, it } from 'vitest'
import type { UserPreference } from '../api/types'
import { suggestOptions } from './skuMatch'

const pref = (body: UserPreference['body_profile']) => ({ personalization_enabled: true, body_profile: body }) as UserPreference

// Mirrors backend/store/tests/test_sku_match.py.
describe('suggestOptions', () => {
  it('matches clothing, bra and shoe sizes', () => {
    expect(suggestOptions({ 尺码: ['S', 'M', 'L'] }, pref({ clothing_size: 'M' }))).toEqual({ 尺码: 'M' })
    expect(suggestOptions({ 尺码: ['70B', '75B'] }, pref({ bra_size: '75B', clothing_size: 'M' }))).toEqual({ 尺码: '75B' })
    expect(suggestOptions({ 尺码: ['35-37', '38-40'] }, pref({ shoe_size: '38' }))).toEqual({ 尺码: '38-40' })
  })

  it('matches shades by skin tone and stays quiet when ambiguous', () => {
    const shades = ['01 象牙白（冷白皮）', '02 自然色（黄一白/自然）', '03 小麦色（黄二白/健康）']
    expect(suggestOptions({ 色号: shades }, pref({ skin_tone: 'warm' }))).toEqual({ 色号: shades[2] })
    expect(suggestOptions({ 色号: ['透明', '豆沙粉（冷调）'] }, pref({ skin_tone: 'neutral' }))).toEqual({})
    expect(suggestOptions({ 尺码: ['S'] }, undefined)).toEqual({})
  })
})
