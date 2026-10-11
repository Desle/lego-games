import { createInMemorySaveStorage } from './in-memory-save-storage.ts'

describe('createInMemorySaveStorage', () => {
  it('keeps a copy of what a slot was given until it is deleted', async () => {
    // Arrange
    const storage = createInMemorySaveStorage()
    const bytes = new Uint8Array([1, 2, 3])

    // Act
    await storage.writeSlot(0, bytes)
    bytes[0] = 9
    const read = await storage.readSlot(0)
    await storage.deleteSlot(0)
    const deleted = await storage.readSlot(0)

    // Assert
    expect(read).toEqual(new Uint8Array([1, 2, 3]))
    expect(deleted).toBeNull()
  })
})
