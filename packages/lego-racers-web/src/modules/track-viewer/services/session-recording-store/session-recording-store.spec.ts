import { createSessionRecordingStore } from './session-recording-store.ts'
import type { RecordingBackend, StoredRecording } from './session-recording-store.types.ts'

const createMemoryBackend = (): RecordingBackend => {
  const recordings = new Map<string, StoredRecording>()
  return {
    put: (recording) => Promise.resolve(recordings.set(recording.key, recording)),
    getKeys: () => Promise.resolve([...recordings.keys()].sort()),
    get: (key) => Promise.resolve(recordings.get(key) ?? null),
    remove: (key) => Promise.resolve(recordings.delete(key)),
  }
}

const createBrokenBackend = (): RecordingBackend => {
  const fail = () => Promise.reject(new Error('IndexedDB is unavailable'))
  return { put: fail, getKeys: fail, get: fail, remove: fail }
}

describe('createSessionRecordingStore', () => {
  it('keeps only the most recent recordings and reads the last one', async () => {
    // Arrange
    const backend = createMemoryBackend()
    const store = createSessionRecordingStore(backend, 3)

    // Act
    for (const name of ['one', 'two', 'three', 'four', 'five']) await store.save(name, name)
    const last = await store.readLast()

    // Assert
    expect(await backend.getKeys()).toHaveLength(3)
    expect(last?.fileName).toBe('five')
  })

  it('falls back to memory when the browser has no storage', async () => {
    // Arrange
    const store = createSessionRecordingStore(createBrokenBackend())

    // Act
    await store.save('race', 'text')
    const last = await store.readLast()

    // Assert
    expect(last?.text).toBe('text')
  })

  it('reads nothing before the first recording', async () => {
    // Arrange
    const store = createSessionRecordingStore(createMemoryBackend())

    // Act
    const last = await store.readLast()

    // Assert
    expect(last).toBeNull()
  })
})
