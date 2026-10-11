import type { SaveStorage } from '../../types/save-data.types.ts'

// The save device keeps 16 slots (FUN_00451080 answers 0x10) and the front end uses at most two (FUN_00443520).
export const SAVE_SLOT_COUNT = 16
export const USED_SAVE_SLOT_COUNT = 2

// A storage for tests and for a viewer that has nothing better; a browser adapter implements the same interface.
export const createInMemorySaveStorage = (): SaveStorage => {
  const slots = new Map<number, Uint8Array>()
  return Object.freeze({
    readSlot: (slot) => Promise.resolve(slots.get(slot)?.slice() ?? null),
    writeSlot: (slot, bytes) => {
      slots.set(slot, bytes.slice())
      return Promise.resolve()
    },
    deleteSlot: (slot) => {
      slots.delete(slot)
      return Promise.resolve()
    },
  })
}
