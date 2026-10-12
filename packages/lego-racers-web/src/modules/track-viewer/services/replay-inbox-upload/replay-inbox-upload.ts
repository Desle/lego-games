import { DEVELOPMENT_REPLAY_INBOX_ROUTE } from '../../../../shared/development-jam/development-replay-inbox-route.ts'
import { sessionRecordingStore } from '../session-recording-store/session-recording-store.ts'
import type { SessionRecordingStore } from '../session-recording-store/session-recording-store.types.ts'

const SENT_STORAGE_KEY = 'lego-racers-sent-recordings'

const readSentFileNames = (): readonly string[] => {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SENT_STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

const markSent = (fileName: string): void => {
  try {
    window.localStorage.setItem(
      SENT_STORAGE_KEY,
      JSON.stringify([...readSentFileNames(), fileName].slice(-100))
    )
  } catch {
    // Without storage the file name (one per recording) still keeps the server from holding a duplicate.
  }
}

// Hands a finished recording to the dev server's inbox (`pnpm run replay:inbox` compares it with the original) and
// remembers it was sent. Development only; quiet when the server is not there.
export const postRecordingToInbox = async (fileName: string, text: string): Promise<void> => {
  if (!import.meta.env.DEV) return
  try {
    const response = await fetch(
      `${DEVELOPMENT_REPLAY_INBOX_ROUTE}?name=${encodeURIComponent(fileName)}`,
      { method: 'POST', body: text }
    )
    if (response.ok) markSent(fileName)
  } catch {
    // The recording is still in the store (F9).
  }
}

// Posts the stored recordings no earlier load sent (those played before the inbox existed, or with the server down).
export const postUnsentRecordings = async (
  store: SessionRecordingStore = sessionRecordingStore
): Promise<void> => {
  if (!import.meta.env.DEV) return
  const sent = new Set(readSentFileNames())
  for (const recording of await store.readAll()) {
    if (!sent.has(recording.fileName)) {
      await postRecordingToInbox(recording.fileName, recording.text)
    }
  }
}
