import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { LDrawSaveRequest } from '@lego-games/ldraw/files'
import { getBuilderItemFile } from './builder-items.ts'
import { BUILDER_PROGRESS_STORE } from './ldraw-builder-route.ts'
import type { BuilderProgress, BuilderSaveProgress } from './ldraw-builder.types.ts'

export const readBuilderProgress = (modelsRoot: string): BuilderProgress => {
  try {
    const parsed: unknown = JSON.parse(
      readFileSync(join(modelsRoot, BUILDER_PROGRESS_STORE), 'utf8')
    )
    const done =
      typeof parsed === 'object' &&
      parsed !== null &&
      'done' in parsed &&
      Array.isArray(parsed.done)
        ? parsed.done.filter((entry): entry is string => typeof entry === 'string')
        : []
    return Object.freeze({ done: Object.freeze(done) })
  } catch {
    return Object.freeze({ done: Object.freeze([]) })
  }
}

export const writeBuilderProgress = (modelsRoot: string, progress: BuilderProgress) => {
  mkdirSync(modelsRoot, { recursive: true })
  writeFileSync(
    join(modelsRoot, BUILDER_PROGRESS_STORE),
    `${JSON.stringify({ done: [...new Set(progress.done)] }, null, 2)}\n`
  )
}

const getItemId = (request: LDrawSaveRequest): string | null =>
  typeof request['itemId'] === 'string' ? request['itemId'] : null

// The models folder's file a builder save (`{ itemId, text }`) writes: the item's file, the one the game reads. Null for an id
// that is not a car, chassis or driver of the builder.
export const getBuilderSavePath = (
  request: LDrawSaveRequest,
  existingFiles: readonly string[]
): string | null => {
  const itemId = getItemId(request)
  return itemId === null ? null : getBuilderItemFile(itemId, existingFiles)
}

// Marks the saved item done, last in the list, and gives the progress for the save's answer.
export const markBuilderItemDone = (
  modelsRoot: string,
  request: LDrawSaveRequest
): BuilderSaveProgress => {
  const itemId = getItemId(request) ?? ''
  const progress = Object.freeze({
    done: Object.freeze([
      ...readBuilderProgress(modelsRoot).done.filter((id) => id !== itemId),
      itemId,
    ]),
  })
  writeBuilderProgress(modelsRoot, progress)
  return Object.freeze({ progress })
}
