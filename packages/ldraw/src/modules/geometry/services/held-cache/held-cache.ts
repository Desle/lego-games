import type { HeldCache, HeldValue } from './held-cache.types.ts'

// Values made once per key and shared by everyone who holds them. A value nobody holds stays until `idleLimit` other idle values are
// newer, then is freed; a failed one is forgotten at once, so it is made again when asked for again.
export const createHeldCache = <Value>(
  free: (value: Value) => void,
  idleLimit: number
): HeldCache<Value> => {
  const values = new Map<string, Promise<Value>>()
  const holderCounts = new Map<string, number>()
  const idleKeys = new Set<string>()
  const forget = (key: string) => {
    values.delete(key)
    holderCounts.delete(key)
    idleKeys.delete(key)
  }
  const freeOldestIdle = () => {
    const [oldest] = idleKeys
    if (oldest === undefined) return
    const value = values.get(oldest)
    forget(oldest)
    value?.then(free, () => undefined)
  }
  const hold = (key: string, create: () => Promise<Value>): HeldValue<Value> => {
    const existing = values.get(key)
    const value = existing ?? create()
    if (existing === undefined) {
      values.set(key, value)
      value.catch(() => {
        if (values.get(key) === value) forget(key)
      })
    }
    idleKeys.delete(key)
    holderCounts.set(key, (holderCounts.get(key) ?? 0) + 1)
    let isReleased = false
    const release = () => {
      if (isReleased || values.get(key) !== value) return
      isReleased = true
      const holders = (holderCounts.get(key) ?? 1) - 1
      holderCounts.set(key, holders)
      if (holders > 0) return
      idleKeys.add(key)
      if (idleKeys.size > idleLimit) freeOldestIdle()
    }
    return { value, release }
  }
  return { hold, getSize: () => values.size }
}
