import { sessionRecordingStore } from '../session-recording-store/session-recording-store.ts'

// Hands the browser the most recent recording as a file; false when there is none.
export const downloadLastRecording = async (): Promise<boolean> => {
  const last = await sessionRecordingStore.readLast()
  if (last === null) return false
  const url = URL.createObjectURL(new Blob([last.text], { type: 'application/x-ndjson' }))
  const link = document.createElement('a')
  link.href = url
  link.download = last.fileName
  link.click()
  URL.revokeObjectURL(url)
  return true
}
