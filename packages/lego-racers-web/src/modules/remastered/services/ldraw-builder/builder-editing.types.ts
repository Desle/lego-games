import type { BuilderPart } from './ldraw-builder.types.ts'

export type AddedParts = {
  readonly parts: readonly BuilderPart[]
  readonly indices: readonly number[]
}
