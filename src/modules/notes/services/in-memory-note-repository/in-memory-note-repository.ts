import type { Note, NoteId, NoteRepository } from '../../types/note.types.ts'

export const createInMemoryNoteRepository = (): NoteRepository => {
  const notes = new Map<NoteId, Note>()
  return Object.freeze({
    findById: (id: NoteId) => Promise.resolve(notes.get(id) ?? null),
    save: (note: Note) => {
      notes.set(note.id, Object.freeze({ ...note }))
      return Promise.resolve()
    },
  })
}
