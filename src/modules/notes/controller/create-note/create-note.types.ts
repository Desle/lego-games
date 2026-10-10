import type { NoteRepository } from '../../types/note.types.ts'

export type CreateNoteDependencies = {
  readonly repository: NoteRepository
  readonly createId: () => string
  readonly now: () => Date
}
