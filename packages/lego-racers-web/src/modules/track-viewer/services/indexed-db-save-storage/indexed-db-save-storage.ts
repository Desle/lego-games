import { createInMemorySaveStorage } from '@lego-games/lego-racers/save-data'
import type { SaveStorage } from '@lego-games/lego-racers/save-data'

const DATABASE_NAME = 'lego-racers'
const STORE_NAME = 'saves'
const DATABASE_VERSION = 1
// The original keeps slot n as the file `Save\<n>\LEGORac1` (0x004512e0, 0x004befd8); the key keeps that name.
const getKey = (slot: number): string => `Save/${String(slot)}/LEGORac1`

const getRequestResult = <Value>(request: IDBRequest<Value>): Promise<Value> =>
  new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result))
    request.addEventListener('error', () =>
      reject(request.error ?? new Error('IndexedDB request failed'))
    )
  })

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.addEventListener('upgradeneeded', () => request.result.createObjectStore(STORE_NAME))
    request.addEventListener('success', () => resolve(request.result))
    request.addEventListener('error', () =>
      reject(request.error ?? new Error('IndexedDB could not be opened'))
    )
    request.addEventListener('blocked', () => reject(new Error('IndexedDB is blocked')))
  })

const getStore = async (
  database: Promise<IDBDatabase>,
  mode: IDBTransactionMode
): Promise<IDBObjectStore> => (await database).transaction(STORE_NAME, mode).objectStore(STORE_NAME)

// The save slots in the browser's IndexedDB: the same bytes the original writes, one record per slot. Every access is
// guarded: a browser without IndexedDB, a private window or a full disk leaves the game running on a store in memory
// (nothing persists), never an error.
export const createIndexedDbSaveStorage = (): SaveStorage => {
  const fallback = createInMemorySaveStorage()
  let database: Promise<IDBDatabase> | null = null
  const getDatabase = (): Promise<IDBDatabase> => {
    database ??= openDatabase()
    return database
  }
  return Object.freeze({
    readSlot: async (slot: number) => {
      try {
        const value: unknown = await getRequestResult(
          (await getStore(getDatabase(), 'readonly')).get(getKey(slot))
        )
        return value instanceof Uint8Array ? value : await fallback.readSlot(slot)
      } catch {
        return fallback.readSlot(slot)
      }
    },
    writeSlot: async (slot: number, bytes: Uint8Array) => {
      await fallback.writeSlot(slot, bytes)
      try {
        await getRequestResult(
          (await getStore(getDatabase(), 'readwrite')).put(bytes.slice(), getKey(slot))
        )
      } catch {
        // The in-memory copy stands: the game runs on without persisting.
      }
    },
    deleteSlot: async (slot: number) => {
      await fallback.deleteSlot(slot)
      try {
        await getRequestResult((await getStore(getDatabase(), 'readwrite')).delete(getKey(slot)))
      } catch {
        // See writeSlot.
      }
    },
  })
}
