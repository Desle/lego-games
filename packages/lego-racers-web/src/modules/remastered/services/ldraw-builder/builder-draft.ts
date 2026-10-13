import type { BuilderDraft, BuilderPart } from './ldraw-builder.types.ts'

const DRAFT_KEY_PREFIX = 'ldraw-builder-draft:'

const getKey = (itemId: string) => `${DRAFT_KEY_PREFIX}${itemId}`

const getIsBuilderPart = (value: unknown): value is BuilderPart =>
  typeof value === 'object' &&
  value !== null &&
  'partName' in value &&
  typeof value.partName === 'string' &&
  'colorCode' in value &&
  typeof value.colorCode === 'number' &&
  'position' in value &&
  Array.isArray(value.position) &&
  'rotation' in value &&
  Array.isArray(value.rotation) &&
  'commentLines' in value &&
  Array.isArray(value.commentLines)

// Unsaved work of an item, kept in this browser after every change so a crash or a closed tab loses nothing. Storage can be missing
// or full; the builder then works as before.
export const getStoredDraft = (itemId: string): BuilderDraft | null => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(getKey(itemId)) ?? 'null')
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('savedAt' in parsed) ||
      typeof parsed.savedAt !== 'number' ||
      !('parts' in parsed) ||
      !Array.isArray(parsed.parts) ||
      !parsed.parts.every(getIsBuilderPart)
    ) {
      return null
    }
    return Object.freeze({ savedAt: parsed.savedAt, parts: Object.freeze([...parsed.parts]) })
  } catch {
    return null
  }
}

export const storeDraft = (itemId: string, parts: readonly BuilderPart[]) => {
  try {
    localStorage.setItem(getKey(itemId), JSON.stringify({ savedAt: Date.now(), parts }))
  } catch {
    // No storage: the work is only lost on a crash, as before.
  }
}

export const clearDraft = (itemId: string) => {
  try {
    localStorage.removeItem(getKey(itemId))
  } catch {
    // Nothing stored.
  }
}
