// One stored recording: its JSON-lines text and the name its file gets.
export type StoredRecording = {
  readonly key: string
  readonly fileName: string
  readonly text: string
}

// Where recordings are kept; the browser's is IndexedDB.
export type RecordingBackend = {
  readonly put: (recording: StoredRecording) => Promise<unknown>
  readonly getKeys: () => Promise<readonly string[]>
  readonly get: (key: string) => Promise<StoredRecording | null>
  readonly remove: (key: string) => Promise<unknown>
}

export type SessionRecordingStore = {
  // Keeps the recording and drops the oldest ones beyond the bound; never throws.
  readonly save: (fileName: string, text: string) => Promise<void>
  // The most recent recording, from the backend or (when the browser has none) from memory.
  readonly readLast: () => Promise<StoredRecording | null>
}
