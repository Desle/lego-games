import { createNoteTitle, MAXIMUM_NOTE_TITLE_LENGTH } from './note-title.ts'

describe('createNoteTitle', () => {
  it('trims surrounding whitespace', () => {
    // Arrange
    const rawTitle = '  Groceries  '

    // Act
    const title = createNoteTitle(rawTitle)

    // Assert
    expect(title).toBe('Groceries')
  })

  it.each(['', '   '])('rejects the empty title %j', (rawTitle) => {
    // Arrange
    const title = rawTitle

    // Act
    const create = () => createNoteTitle(title)

    // Assert
    expect(create).toThrow('A note title cannot be empty')
  })

  it('rejects a title over the maximum length', () => {
    // Arrange
    const rawTitle = 'a'.repeat(MAXIMUM_NOTE_TITLE_LENGTH + 1)

    // Act
    const create = () => createNoteTitle(rawTitle)

    // Assert
    expect(create).toThrow(/at most 120 characters/)
  })
})
