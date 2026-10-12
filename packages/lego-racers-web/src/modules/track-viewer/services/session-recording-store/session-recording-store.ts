import { getRequestResult, openDatabase } from '../indexed-db/indexed-db.ts'
import type {
  RecordingBackend,
  SessionRecordingStore,
  StoredRecording,
} from './session-recording-store.types.ts'

const DATABASE_NAME = 'lego-racers-recordings'
const STORE_NAME = 'recordings'
const DATABASE_VERSION = 1
export const MAXIMUM_STORED_RECORDINGS = 20
const KEY_DIGIT_COUNT = 15

const isStoredRecording = (value: unknown): value is StoredRecording =>
  typeof value === 'object' &&
  value !== null &&
  'key' in value &&
  'fileName' in value &&
  'text' in value

export const createIndexedDbRecordingBackend = (): RecordingBackend => {
  let database: Promise<IDBDatabase> | null = null
  const getStore = async (mode: IDBTransactionMode): Promise<IDBObjectStore> => {
    database ??= openDatabase(DATABASE_NAME, STORE_NAME, DATABASE_VERSION)
    return (await database).transaction(STORE_NAME, mode).objectStore(STORE_NAME)
  }
  return Object.freeze({
    put: async (recording) =>
      getRequestResult((await getStore('readwrite')).put(recording, recording.key)),
    getKeys: async () => {
      const keys = await getRequestResult((await getStore('readonly')).getAllKeys())
      return keys.map(String).sort()
    },
    get: async (key) => {
      const value: unknown = await getRequestResult((await getStore('readonly')).get(key))
      return isStoredRecording(value) ? value : null
    },
    remove: async (key) => getRequestResult((await getStore('readwrite')).delete(key)),
  })
}

// The recent recordings of the player's own sessions (the last 20). Every access is guarded: a browser without
// IndexedDB, a private window or a full disk leaves the last recording in memory and the game running.
export const createSessionRecordingStore = (
  backend: RecordingBackend,
  maximumCount: number = MAXIMUM_STORED_RECORDINGS
): SessionRecordingStore => {
  let last: StoredRecording | null = null
  let counter = 0
  return Object.freeze({
    save: async (fileName, text) => {
      counter += 1
      const key = `${String(Date.now()).padStart(KEY_DIGIT_COUNT, '0')}-${String(counter).padStart(KEY_DIGIT_COUNT, '0')}`
      last = Object.freeze({ key, fileName, text })
      try {
        await backend.put(last)
        const keys = await backend.getKeys()
        await Promise.all(
          keys.slice(0, Math.max(0, keys.length - maximumCount)).map(backend.remove)
        )
      } catch {
        // The in-memory copy stands.
      }
    },
    readLast: async () => {
      try {
        const keys = await backend.getKeys()
        const newest = keys[keys.length - 1]
        const stored = newest === undefined ? null : await backend.get(newest)
        return stored ?? last
      } catch {
        return last
      }
    },
  })
}

export const sessionRecordingStore = createSessionRecordingStore(createIndexedDbRecordingBackend())
