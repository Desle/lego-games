import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'
import type { PartConnection } from '@lego-games/ldraw/building'
import type { SnapContext } from './builder-snapping.types.ts'
import type { BuilderPart, BuilderPartLine, Vector } from './ldraw-builder.types.ts'
import type { PointerPosition } from './ldraw-builder-page.types.ts'

// How a drag moves the selection: across the ground (onto the nearest connection), held to one ground axis (⇧), or up and down (⌘).
export const DragMode = createEnum({
  FREE: 'free',
  AXIS: 'axis',
  VERTICAL: 'vertical',
})
export type DragMode = EnumValues<typeof DragMode>

// The cursor's ray in the editing frame.
export type EditRay = {
  readonly origin: Vector
  readonly direction: Vector
}

// What a drag reads of the build view.
export type DragView = {
  readonly getGroundPoint: (position: PointerPosition, height: number) => Vector | null
  readonly getRay: (position: PointerPosition) => EditRay | null
  // Where a point of the editing frame is on the screen, in pixels.
  readonly project: (point: Vector) => readonly [number, number]
  // Where the cursor is on the screen, in the same pixels.
  readonly toScreen: (position: PointerPosition) => readonly [number, number]
  readonly getConnections: (part: BuilderPartLine) => readonly PartConnection[]
  readonly snapContext: SnapContext
}

// A drag under way: the parts as they were when its mode began, the grabbed point on the selection then, where the cursor met the
// ground at its height (across) or the height it pointed at (up and down), and the last draft (what a change of mode starts from).
export type DragState = {
  readonly mode: DragMode
  readonly base: readonly BuilderPart[]
  readonly grabbed: Vector
  readonly groundStart: Vector
  readonly heightStart: number | null
  readonly pointerStart: PointerPosition
  readonly parts: readonly BuilderPart[]
}

// A line drawn while dragging: the axis ⇧ holds to, or the upright ⌘ moves along.
export type DragGuide = {
  readonly from: Vector
  readonly to: Vector
}

// What a step of the drag shows: the moved parts, the connection they join (null: on the stud grid) and the guide line.
export type DragDraft = {
  readonly state: DragState
  readonly target: Vector | null
  readonly guide: DragGuide | null
}

export type DragModifiers = {
  readonly isShift: boolean
  readonly isCommand: boolean
}
