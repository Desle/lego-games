import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'
import type { PartStud } from './builder-studs.types.ts'
import type { BuilderPart, PlacementTarget, Vector } from './ldraw-builder.types.ts'

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
  // The stud the part in hand goes onto when it is a side stud (not pointing up), in the editing frame.
  readonly sideStud: PartStud | null
}

export type PointerPosition = {
  readonly clientX: number
  readonly clientY: number
}

// What a press in the build view turns into: Option drags the camera, a part in hand is placed, else parts are selected or moved.
export const PointerGesture = createEnum({
  ORBIT: 'orbit',
  PAN: 'pan',
  PLACE: 'place',
  SELECT: 'select',
  MOVE: 'move',
})
export type PointerGesture = EnumValues<typeof PointerGesture>

export type PointerPress = {
  readonly start: PointerPosition
  readonly last: PointerPosition
  readonly gesture: PointerGesture
  // The editable part pressed on, null elsewhere.
  readonly partIndex: number | null
  readonly isAlreadySelected: boolean
  readonly isShift: boolean
  // Where the press met the ground at the pressed part's height, for a drag along the stud grid.
  readonly groundStart: Vector | null
  readonly isDragging: boolean
}
