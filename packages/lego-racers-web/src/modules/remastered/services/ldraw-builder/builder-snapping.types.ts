import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'
import type { PartShape } from '@lego-games/ldraw/building'
import type { BuilderBox, BuilderPart, Vector } from './ldraw-builder.types.ts'

// What the builder knows of the parts it snaps: each part's shape (undefined while it has not arrived) and box, and the ground.
export type SnapContext = {
  readonly getShape: (partName: string) => PartShape | undefined
  readonly getBox: (part: BuilderPart) => BuilderBox | null
  readonly groundHeight: number
}

// How a key changes the selection: a stud across (resting on what is under it), a plate or a brick up or down (on the plate grid of
// what is under it), a fine nudge (off the grid, on purpose), a quarter turn or a tilt (then snapped like a step).
export const SelectionEditKind = createEnum({
  STEP: 'step',
  LIFT: 'lift',
  NUDGE: 'nudge',
  TURN: 'turn',
  TILT: 'tilt',
})
export type SelectionEditKind = EnumValues<typeof SelectionEditKind>

export type SelectionEdit = {
  readonly kind: SelectionEditKind
  // The move (a step, a lift, a nudge); the axis of a tilt.
  readonly offset: Vector
  readonly isBack: boolean
}

// A part of the selection or under it, with what snapping reads of it in the editing frame.
export type SnappedPart = {
  readonly part: BuilderPart
  readonly shape: PartShape
  readonly box: BuilderBox
  readonly placedBox: BuilderBox
  // How far down it reaches: the y its bottom stands at.
  readonly bottom: number
}
