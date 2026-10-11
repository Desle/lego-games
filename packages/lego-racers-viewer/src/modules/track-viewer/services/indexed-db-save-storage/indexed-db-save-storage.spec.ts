import { createIndexedDbSaveStorage } from './indexed-db-save-storage.ts'

// jsdom has no IndexedDB: every access fails and the storage keeps the bytes in memory, which is how the game runs in a
// browser that refuses IndexedDB (a private window, blocked site data).
describe('createIndexedDbSaveStorage without IndexedDB', () => {
  it('reads nothing from an empty slot instead of failing', async () => {
    // Arrange
    const storage = createIndexedDbSaveStorage()

    // Act
    const bytes = await storage.readSlot(0)

    // Assert
    expect(bytes).toBeNull()
  })

  it('keeps a written slot for the session and forgets a deleted one', async () => {
    // Arrange
    const storage = createIndexedDbSaveStorage()

    // Act
    await storage.writeSlot(1, Uint8Array.of(76, 82, 4))
    const written = await storage.readSlot(1)
    await storage.deleteSlot(1)
    const deleted = await storage.readSlot(1)

    // Assert
    expect(Array.from(written ?? [])).toEqual([76, 82, 4])
    expect(deleted).toBeNull()
  })
})
