import { create } from 'zustand'
import { getMeta, loadProfiles, saveProfiles, setMeta } from '../lib/db'

/**
 * Preference profiles. The backend keys preferences by user_id, so a profile is
 * a local name + avatar pointing at its own user_id (handoff doc: 偏好档案 = 换
 * user_id). The default profile uses iOS's UserIdentity.defaultUserID.
 */
export interface Profile {
  id: string
  name: string
  userId: string
  /** Avatar background; the initial is the first character of the name. */
  color: string
}

export const DEFAULT_USER_ID = 'local-user'
export const DEFAULT_PROFILE: Profile = { id: 'default', name: '我', userId: DEFAULT_USER_ID, color: '#D9CFC4' }
const AVATAR_COLORS = ['#D9CFC4', '#C9D3CC', '#CCC6D9', '#D9C4C4', '#C4D2D9', '#D6D0B8']

interface ProfilesState {
  profiles: Profile[]
  activeId: string
  setActive: (id: string) => void
  create: (name: string) => Profile
  rename: (id: string, name: string) => void
  remove: (id: string) => void
}

export const useProfiles = create<ProfilesState>((set, get) => ({
  profiles: [DEFAULT_PROFILE],
  activeId: DEFAULT_PROFILE.id,
  setActive: (id) => set({ activeId: id }),
  create: (name) => {
    const id = crypto.randomUUID().slice(0, 8)
    const profile: Profile = {
      id,
      name: name.trim() || '新档案',
      userId: `profile-${id}`,
      color: AVATAR_COLORS[get().profiles.length % AVATAR_COLORS.length],
    }
    set((s) => ({ profiles: [...s.profiles, profile], activeId: profile.id }))
    return profile
  },
  rename: (id, name) => set((s) => ({ profiles: s.profiles.map((p) => (p.id === id && name.trim() ? { ...p, name: name.trim() } : p)) })),
  remove: (id) =>
    set((s) => {
      if (id === DEFAULT_PROFILE.id || s.profiles.length <= 1) return s
      const profiles = s.profiles.filter((p) => p.id !== id)
      return { profiles, activeId: s.activeId === id ? profiles[0].id : s.activeId }
    }),
}))

export function useActiveProfile(): Profile {
  return useProfiles((s) => s.profiles.find((p) => p.id === s.activeId) ?? s.profiles[0] ?? DEFAULT_PROFILE)
}

/** "我" stays as is; other names read like the artboard, e.g. "给妈妈买". */
export function profileLabel(p: Profile): string {
  return p.id === DEFAULT_PROFILE.id && p.name !== '我' ? `${p.name}（我）` : p.name
}

export async function hydrateProfiles() {
  try {
    const [stored, activeId] = await Promise.all([loadProfiles(), getMeta<string>('activeProfile')])
    if (stored.length) {
      const profiles = stored.some((p) => p.id === DEFAULT_PROFILE.id) ? stored : [DEFAULT_PROFILE, ...stored]
      profiles.sort((a, b) => (a.id === DEFAULT_PROFILE.id ? -1 : b.id === DEFAULT_PROFILE.id ? 1 : 0))
      useProfiles.setState({ profiles, activeId: activeId && profiles.some((p) => p.id === activeId) ? activeId : DEFAULT_PROFILE.id })
    }
  } catch {
    /* storage unavailable: keep the default profile */
  }
  useProfiles.subscribe((s, prev) => {
    if (s.profiles !== prev.profiles) void saveProfiles(s.profiles).catch(() => undefined)
    if (s.activeId !== prev.activeId) void setMeta('activeProfile', s.activeId).catch(() => undefined)
  })
}
