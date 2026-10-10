import type { Note, NoteId, NoteTitle } from '../../types/note.types.ts'
import { createInMemoryNoteRepository } from './in-memory-note-repository.ts'

const NOTE: Note = {
  id: 'note-1' as NoteId,
  title: 'Groceries' as NoteTitle,
  isPinned: false,
  createdAt: new Date('2026-10-04T12:00:00Z'),
}

describe('createInMemoryNoteRepository', () => {
  it('returns a saved note by id', async () => {
    // Arrange
    const repository = createInMemoryNoteRepository()
    await repository.save(NOTE)

    // Act
    const found = await repository.findById(NOTE.id)

    // Assert
    expect(found).toEqual(NOTE)
  })

  it('returns null for an unknown id', async () => {
    // Arrange
    const repository = createInMemoryNoteRepository()

    // Act
    const found = await repository.findById('missing' as NoteId)

    // Assert
    expect(found).toBeNull()
  })
})
