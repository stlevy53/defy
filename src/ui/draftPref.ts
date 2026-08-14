// Whether a new game asks "draft or skip". Default on; Settings can turn it off.
// Same storage surface as the coach / What's New helpers so tests can inject a map.

import type { StorageLike } from './coachLaunch'

export const ASK_DRAFT_KEY = 'defy.askDraft'

function liveStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

function read(store: StorageLike | null, key: string): string | null {
  if (!store) return null
  try {
    return store.getItem(key)
  } catch {
    return null
  }
}

function write(store: StorageLike | null, key: string, value: string): void {
  if (!store) return
  try {
    store.setItem(key, value)
  } catch {
    /* quota / private mode */
  }
}

/** Default on: every new game offers the rulebook draft. `'0'` turns the prompt off. */
export function isDraftPromptEnabled(storage?: StorageLike): boolean {
  return read(storage ?? liveStorage(), ASK_DRAFT_KEY) !== '0'
}

export function setDraftPromptEnabled(on: boolean, storage?: StorageLike): void {
  write(storage ?? liveStorage(), ASK_DRAFT_KEY, on ? '1' : '0')
}
