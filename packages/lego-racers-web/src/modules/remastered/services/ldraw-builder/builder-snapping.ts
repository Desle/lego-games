import { Vector3 } from 'three'
import { LDRAW_TO_STUDS } from '../ldraw-car/ldraw-car-document.ts'
import { getBuilderGroundAxes } from './builder-camera.ts'
import type { BuilderView } from './builder-camera.types.ts'
import {
  getGridPoint,
  getGroundPhase,
  getPartBottom,
  getPartPhase,
  getPlacedBox,
  getPlacementPosition,
  getRotatedBox,
  getStudStep,
  getTopGridPoint,
  moveParts,
  PLATE_HEIGHT,
  STUD_WIDTH,
  tiltParts,
  turnParts,
} from '@lego-games/ldraw/building'
import { BuilderAction } from './builder-shortcuts.types.ts'
import { SelectionEditKind } from './builder-snapping.types.ts'
import type { SelectionEdit, SnapContext, SnappedPart } from './builder-snapping.types.ts'
import type { PartShape } from '@lego-games/ldraw/building'
import type { BuilderBox, BuilderPart, Vector } from './ldraw-builder.types.ts'

const BRICK_HEIGHT = 3 * PLATE_HEIGHT
const NUDGE_ACROSS = STUD_WIDTH / 4
const NUDGE_HEIGHT = PLATE_HEIGHT / 2
const HALF_STUD = STUD_WIDTH / 2
const OVERLAP = 0.5
const SAME = 0.01
const TIE_BIAS = 0.01
const HALF_TURN_ENTRY = 0.5
const NO_SHAPE: PartShape = Object.freeze({
  studs: [],
  holes: [],
  box: null,
  footprint: null,
  bottom: null,
  description: '',
})
const UP: Vector = [0, -1, 0]
const STUDS_TO_LDRAW = LDRAW_TO_STUDS.clone().invert()

// The camera's right or forward, along the nearest of the editing frame's ground axes (the editing frame only moves the LDraw frame).
export const getCameraStudStep = (view: BuilderView, isForward: boolean, sign: number): Vector => {
  const axes = getBuilderGroundAxes(view)
  const direction = new Vector3(...(isForward ? axes.forward : axes.right))
    .multiplyScalar(sign)
    .transformDirection(STUDS_TO_LDRAW)
  return getStudStep([direction.x, direction.y, direction.z])
}

const createEdit = (kind: SelectionEditKind, offset: Vector, isBack = false): SelectionEdit =>
  Object.freeze({ kind, offset, isBack })

const getNudge = (step: Vector): Vector => [
  Math.sign(step[0]) * NUDGE_ACROSS,
  0,
  Math.sign(step[2]) * NUDGE_ACROSS,
]

const getTiltAxis = (step: Vector): Vector => [Math.sign(step[0]), 0, Math.sign(step[2])]

// What a key does to the selection, seen from the camera; null for a key that does not change it.
export const getSelectionEdit = (
  action: BuilderAction,
  view: BuilderView
): SelectionEdit | null => {
  const getStep = (isForward: boolean, sign: number) => getCameraStudStep(view, isForward, sign)
  const edits: Partial<Record<BuilderAction, () => SelectionEdit>> = {
    [BuilderAction.ROTATE]: () => createEdit(SelectionEditKind.TURN, [0, 0, 0]),
    [BuilderAction.ROTATE_BACK]: () => createEdit(SelectionEditKind.TURN, [0, 0, 0], true),
    [BuilderAction.TILT]: () => createEdit(SelectionEditKind.TILT, getTiltAxis(getStep(false, 1))),
    [BuilderAction.TILT_BACK]: () =>
      createEdit(SelectionEditKind.TILT, getTiltAxis(getStep(false, -1)), true),
    [BuilderAction.MOVE_LEFT]: () => createEdit(SelectionEditKind.STEP, getStep(false, -1)),
    [BuilderAction.MOVE_RIGHT]: () => createEdit(SelectionEditKind.STEP, getStep(false, 1)),
    [BuilderAction.MOVE_AWAY]: () => createEdit(SelectionEditKind.STEP, getStep(true, 1)),
    [BuilderAction.MOVE_TOWARD]: () => createEdit(SelectionEditKind.STEP, getStep(true, -1)),
    [BuilderAction.RAISE_PLATE]: () => createEdit(SelectionEditKind.LIFT, [0, -PLATE_HEIGHT, 0]),
    [BuilderAction.LOWER_PLATE]: () => createEdit(SelectionEditKind.LIFT, [0, PLATE_HEIGHT, 0]),
    [BuilderAction.RAISE_BRICK]: () => createEdit(SelectionEditKind.LIFT, [0, -BRICK_HEIGHT, 0]),
    [BuilderAction.LOWER_BRICK]: () => createEdit(SelectionEditKind.LIFT, [0, BRICK_HEIGHT, 0]),
    [BuilderAction.NUDGE_LEFT]: () =>
      createEdit(SelectionEditKind.NUDGE, getNudge(getStep(false, -1))),
    [BuilderAction.NUDGE_RIGHT]: () =>
      createEdit(SelectionEditKind.NUDGE, getNudge(getStep(false, 1))),
    [BuilderAction.NUDGE_AWAY]: () =>
      createEdit(SelectionEditKind.NUDGE, getNudge(getStep(true, 1))),
    [BuilderAction.NUDGE_TOWARD]: () =>
      createEdit(SelectionEditKind.NUDGE, getNudge(getStep(true, -1))),
    [BuilderAction.NUDGE_UP]: () => createEdit(SelectionEditKind.NUDGE, [0, -NUDGE_HEIGHT, 0]),
    [BuilderAction.NUDGE_DOWN]: () => createEdit(SelectionEditKind.NUDGE, [0, NUDGE_HEIGHT, 0]),
  }
  return edits[action]?.() ?? null
}

const getSnappedPart = (part: BuilderPart, context: SnapContext): SnappedPart | null => {
  const box = context.getBox(part)
  if (box === null) return null
  const shape = context.getShape(part.partName) ?? NO_SHAPE
  return {
    part,
    shape,
    box,
    placedBox: getPlacedBox(box, part),
    bottom: part.position[1] + getPartBottom(shape, box, part.rotation),
  }
}

const getChosenParts = (
  parts: readonly BuilderPart[],
  indices: readonly number[],
  context: SnapContext
): readonly SnappedPart[] =>
  indices
    .map((index) => parts[index])
    .filter((part): part is BuilderPart => part !== undefined)
    .map((part) => getSnappedPart(part, context))
    .filter((entry): entry is SnappedPart => entry !== null)

const getIsOverlapping = (first: BuilderBox, second: BuilderBox) =>
  [0, 2].every(
    (axis) =>
      (first.minimum[axis] ?? 0) < (second.maximum[axis] ?? 0) - OVERLAP &&
      (first.maximum[axis] ?? 0) > (second.minimum[axis] ?? 0) + OVERLAP
  )

const getUnionBox = (boxes: readonly BuilderBox[]): BuilderBox => {
  const getLeast = (axis: number) => Math.min(...boxes.map((box) => box.minimum[axis] ?? 0))
  const getMost = (axis: number) => Math.max(...boxes.map((box) => box.maximum[axis] ?? 0))
  return {
    minimum: [getLeast(0), getLeast(1), getLeast(2)],
    maximum: [getMost(0), getMost(1), getMost(2)],
  }
}

const getMiddle = (box: BuilderBox, axis: number) =>
  ((box.minimum[axis] ?? 0) + (box.maximum[axis] ?? 0)) / 2

const snapOnce = (
  parts: readonly BuilderPart[],
  indices: readonly number[],
  context: SnapContext,
  isResting: boolean
): readonly BuilderPart[] => {
  const chosen = getChosenParts(parts, indices, context)
  const anchor = chosen.reduce<SnappedPart | null>(
    (lowest, entry) => (lowest === null || entry.bottom > lowest.bottom ? entry : lowest),
    null
  )
  if (anchor === null) return parts
  const supports = parts
    .filter((_part, index) => !indices.includes(index))
    .map((part) => getSnappedPart(part, context))
    .filter(
      (entry): entry is SnappedPart =>
        entry !== null &&
        getIsOverlapping(entry.placedBox, anchor.placedBox) &&
        (isResting
          ? entry.placedBox.minimum[1] >= anchor.placedBox.minimum[1] - SAME
          : entry.placedBox.minimum[1] >= anchor.placedBox.minimum[1] - SAME)
    )
  const support = supports.reduce<SnappedPart | null>(
    (highest, entry) =>
      highest === null || entry.placedBox.minimum[1] < highest.placedBox.minimum[1]
        ? entry
        : highest,
    null
  )
  const restingHeight = support?.placedBox.minimum[1] ?? context.groundHeight
  // Half a stud from two grid spots (a 1 x 2 turned), it goes one way turned a quarter and back the other: R R puts it where it was.
  const tieBias = Math.abs(anchor.part.rotation[0] ?? 1) < HALF_TURN_ENTRY ? TIE_BIAS : -TIE_BIAS
  const point: Vector = [
    getMiddle(anchor.placedBox, 0) + tieBias,
    isResting ? restingHeight : anchor.bottom,
    getMiddle(anchor.placedBox, 2) + tieBias,
  ]
  const phase =
    support === null
      ? getGroundPhase(context.groundHeight)
      : getPartPhase(
          getTopGridPoint(support.shape.studs, support.box, support.part, point),
          support.part
        )
  const rotation = anchor.part.rotation
  const position = getPlacementPosition(
    { point, normal: UP, phase },
    getRotatedBox(anchor.box, rotation),
    getGridPoint(anchor.shape, anchor.box, rotation),
    getPartBottom(anchor.shape, anchor.box, rotation)
  )
  const offset: Vector = [
    position[0] - anchor.part.position[0],
    position[1] - anchor.part.position[1],
    position[2] - anchor.part.position[2],
  ]
  return offset.every((value) => Math.abs(value) < SAME) ? parts : moveParts(parts, indices, offset)
}

// The selection moved so its lowest part sits on the stud grid of what is under it: resting on it (on the highest part its box is
// over, else the ground), or, when it was not resting, on the plate level at or below its bottom. Its parts keep their offsets. A
// second pass settles a part the grid moved off the part it was over (a turned 1 x 2 at an edge).
export const snapSelection = (
  parts: readonly BuilderPart[],
  indices: readonly number[],
  context: SnapContext,
  isResting: boolean
): readonly BuilderPart[] =>
  snapOnce(snapOnce(parts, indices, context, isResting), indices, context, isResting)

// Whether the selection rests on what is under it, snapped: then a step or a turn keeps it resting (on whatever it moves over).
export const getIsSelectionResting = (
  parts: readonly BuilderPart[],
  indices: readonly number[],
  context: SnapContext
): boolean => {
  const snapped = snapSelection(parts, indices, context, true)
  return indices.every(
    (index) =>
      Math.abs((snapped[index]?.position[1] ?? 0) - (parts[index]?.position[1] ?? 0)) < SAME
  )
}

// The middle of the selection's boxes, on the half-stud grid: a turn keeps the selection's footprint where it was.
const getTurnPivot = (
  parts: readonly BuilderPart[],
  indices: readonly number[],
  context: SnapContext
): Vector | null => {
  const boxes = indices
    .map((index) => parts[index])
    .filter((part): part is BuilderPart => part !== undefined)
    .map((part) => {
      const box = context.getBox(part)
      return box === null ? null : getPlacedBox(box, part)
    })
    .filter((box): box is BuilderBox => box !== null)
  if (boxes.length === 0) return null
  const union = getUnionBox(boxes)
  const getAxis = (axis: number) => HALF_STUD * Math.round(getMiddle(union, axis) / HALF_STUD)
  return [getAxis(0), 0, getAxis(2)]
}

// Straight up or down by whole plates: the lowest part's bottom goes to the plate level that many levels from the one nearest it, and
// nothing moves across (a lift never slides onto the grid of a part above or below).
const liftSelection = (
  parts: readonly BuilderPart[],
  indices: readonly number[],
  offset: Vector,
  context: SnapContext
): readonly BuilderPart[] => {
  const bottoms = getChosenParts(parts, indices, context).map((entry) => entry.bottom)
  if (bottoms.length === 0) return moveParts(parts, indices, offset)
  const bottom = Math.max(...bottoms)
  const levels = Math.round(offset[1] / PLATE_HEIGHT)
  const level = Math.round((bottom - context.groundHeight) / PLATE_HEIGHT) + levels
  const rise = context.groundHeight + level * PLATE_HEIGHT - bottom
  // Going down it stops on what is under it (y is down): it never sinks into a part or the ground.
  const first = indices[0] ?? 0
  const rested = snapSelection(parts, indices, context, true)
  const fall = (rested[first]?.position[1] ?? 0) - (parts[first]?.position[1] ?? 0)
  return moveParts(parts, indices, [0, Math.min(rise, Math.max(fall, 0)), 0])
}

// A key's edit of the selection: every edit but a nudge leaves it on the stud grid of what is under it, a step and a turn resting on
// it when it rested before.
export const applySelectionEdit = (
  parts: readonly BuilderPart[],
  indices: readonly number[],
  edit: SelectionEdit,
  context: SnapContext
): readonly BuilderPart[] => {
  if (indices.length === 0) return parts
  if (edit.kind === SelectionEditKind.NUDGE) return moveParts(parts, indices, edit.offset)
  if (edit.kind === SelectionEditKind.LIFT)
    return liftSelection(parts, indices, edit.offset, context)
  const isResting = getIsSelectionResting(parts, indices, context)
  const edited =
    edit.kind === SelectionEditKind.STEP
      ? moveParts(parts, indices, edit.offset)
      : edit.kind === SelectionEditKind.TURN
        ? turnParts(parts, indices, edit.isBack, getTurnPivot(parts, indices, context))
        : tiltParts(parts, indices, edit.offset)
  return snapSelection(edited, indices, context, isResting)
}

// A drag of the selection by whole studs, snapped like a step.
export const dragSelection = (
  parts: readonly BuilderPart[],
  indices: readonly number[],
  offset: Vector,
  context: SnapContext
): readonly BuilderPart[] =>
  snapSelection(
    moveParts(parts, indices, offset),
    indices,
    context,
    getIsSelectionResting(parts, indices, context)
  )
