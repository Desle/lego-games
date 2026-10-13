import type { BuilderPart, PlacementTarget } from './ldraw-builder.types.ts'

// The part in hand: what a click places.
export type BuilderTool = {
  readonly partName: string
  readonly colorCode: number
  readonly rotation: readonly number[]
}

// What is under the cursor in the build view.
export type PointerHit = {
  readonly target: PlacementTarget
  // The editable part's index, null on a chassis part or the ground.
  readonly partIndex: number | null
  // The part, editable or not, null on the ground.
  readonly part: BuilderPart | null
}

export type PointerPosition = {
  readonly clientX: number
  readonly clientY: number
}
