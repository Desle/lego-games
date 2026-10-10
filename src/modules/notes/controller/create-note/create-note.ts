import { createNoteTitle } from '../../types/note-title/note-title.ts'
import type { Note, NoteId } from '../../types/note.types.ts'
import type { CreateNoteDependencies } from './create-note.types.ts'

export const createNote = async (
  dependencies: CreateNoteDependencies,
  rawTitle: string
): Promise<Note> => {
  const note: Note = Object.freeze({
    id: dependencies.createId() as NoteId,
    title: createNoteTitle(rawTitle),
    isPinned: false,
    createdAt: dependencies.now(),
  })
  await dependencies.repository.save(note)
  return note
}
