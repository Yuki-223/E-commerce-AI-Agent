import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Conversation } from '../stores/conversations'
import type { Profile } from '../stores/profiles'

/**
 * Browser-local storage for what iOS keeps on the device: conversation history
 * (ConversationStore.swift) and the preference-profile list.
 */
interface CartPilotDB extends DBSchema {
  conversations: { key: string; value: Conversation; indexes: { updatedAt: number } }
  profiles: { key: string; value: Profile }
  meta: { key: string; value: unknown }
}

let dbPromise: Promise<IDBPDatabase<CartPilotDB>> | null = null

export function db() {
  dbPromise ??= openDB<CartPilotDB>('cartpilot', 1, {
    upgrade(d) {
      const conv = d.createObjectStore('conversations', { keyPath: 'id' })
      conv.createIndex('updatedAt', 'updatedAt')
      d.createObjectStore('profiles', { keyPath: 'id' })
      d.createObjectStore('meta')
    },
  })
  return dbPromise
}

export async function loadConversations(): Promise<Conversation[]> {
  return (await db()).getAll('conversations')
}

export async function saveConversations(changed: Conversation[], removed: string[]) {
  const tx = (await db()).transaction('conversations', 'readwrite')
  await Promise.all([...changed.map((c) => tx.store.put(c)), ...removed.map((id) => tx.store.delete(id)), tx.done])
}

export async function loadProfiles(): Promise<Profile[]> {
  return (await db()).getAll('profiles')
}

export async function saveProfiles(profiles: Profile[]) {
  const tx = (await db()).transaction('profiles', 'readwrite')
  await tx.store.clear()
  await Promise.all([...profiles.map((p) => tx.store.put(p)), tx.done])
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db()).get('meta', key) as Promise<T | undefined>
}

export async function setMeta(key: string, value: unknown) {
  await (await db()).put('meta', value, key)
}
