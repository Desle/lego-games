import { randomUUID } from 'node:crypto'
import { createInMemoryNoteRepository, createNote } from './modules/notes/index.ts'
import { getEnvironment } from './shared/environment/environment.ts'

const environment = getEnvironment()
const repository = createInMemoryNoteRepository()
const note = await createNote(
  { repository, createId: randomUUID, now: () => new Date() },
  'Hello from the starter'
)

console.log(`[${environment.name}] created note "${note.title}"`)
