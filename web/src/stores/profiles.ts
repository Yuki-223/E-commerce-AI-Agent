import { create } from 'zustand'

/**
 * Preference profiles. The backend keys preferences by user_id, so a profile is
 * a local name + avatar pointing at its own user_id. The default profile uses
 * iOS's UserIdentity.defaultUserID.
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

interface ProfilesState {
  profiles: Profile[]
  activeId: string
  setActive: (id: string) => void
}

export const useProfiles = create<ProfilesState>((set) => ({
  profiles: [DEFAULT_PROFILE],
  activeId: DEFAULT_PROFILE.id,
  setActive: (id) => set({ activeId: id }),
}))

export function useActiveProfile(): Profile {
  return useProfiles((s) => s.profiles.find((p) => p.id === s.activeId) ?? s.profiles[0] ?? DEFAULT_PROFILE)
}
