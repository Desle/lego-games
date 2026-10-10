export type NoteId = string & { readonly __brand: 'NoteId' }

export type NoteTitle = string & { readonly __brand: 'NoteTitle' }

export type Note = {
  readonly id: NoteId
  readonly title: NoteTitle
  readonly isPinned: boolean
  readonly createdAt: Date
}

export type NoteRepository = {
  readonly findById: (id: NoteId) => Promise<Note | null>
  readonly save: (note: Note) => Promise<void>
}
