import type { NoteTitle } from '../note.types.ts'

export const MAXIMUM_NOTE_TITLE_LENGTH = 120

export const createNoteTitle = (rawTitle: string): NoteTitle => {
  const title = rawTitle.trim()
  if (title === '') throw new Error('A note title cannot be empty')
  if (title.length > MAXIMUM_NOTE_TITLE_LENGTH) {
    throw new Error(`A note title is at most ${String(MAXIMUM_NOTE_TITLE_LENGTH)} characters`)
  }
  return title as NoteTitle
}
