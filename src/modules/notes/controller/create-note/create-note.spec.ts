import type { NoteId } from '../../types/note.types.ts'
import { createInMemoryNoteRepository } from '../../services/in-memory-note-repository/in-memory-note-repository.ts'
import { createNote } from './create-note.ts'

const createDependencies = () => ({
  repository: createInMemoryNoteRepository(),
  createId: () => 'note-1',
  now: () => new Date('2026-10-04T12:00:00Z'),
})

describe('createNote', () => {
  it('creates an unpinned note and saves it', async () => {
    // Arrange
    const dependencies = createDependencies()

    // Act
    const note = await createNote(dependencies, ' Groceries ')

    // Assert
    expect(note).toEqual({
      id: 'note-1',
      title: 'Groceries',
      isPinned: false,
      createdAt: new Date('2026-10-04T12:00:00Z'),
    })
    expect(await dependencies.repository.findById(note.id)).toEqual(note)
  })

  it('saves nothing when the title is invalid', async () => {
    // Arrange
    const dependencies = createDependencies()

    // Act
    const creation = createNote(dependencies, '   ')

    // Assert
    await expect(creation).rejects.toThrow('A note title cannot be empty')
    expect(await dependencies.repository.findById('note-1' as NoteId)).toBeNull()
  })
})
