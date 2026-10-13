import type { BuilderPart } from '../../types/building.types.ts'

export type AddedParts = {
  readonly parts: readonly BuilderPart[]
  readonly indices: readonly number[]
}
