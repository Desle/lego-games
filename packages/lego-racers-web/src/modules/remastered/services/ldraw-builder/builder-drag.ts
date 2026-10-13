import {
  addVectors,
  applyConnectionSnap,
  findConnectionSnap,
  getDominantAxis,
  getIsAlongAxis,
  getIsVertical,
  getPartConnections,
  getPlateOffset,
  getRayHeight,
  getStudOffset,
  getVectorDifference,
  lockToAxis,
  moveParts,
  PLATE_HEIGHT,
} from '@lego-games/ldraw/building'
import type {
  ConnectedPart,
  ConnectionSnap,
  PartConnection,
  PartShape,
} from '@lego-games/ldraw/building'
import { dragSelection } from './builder-snapping.ts'
import { DragMode } from './builder-drag.types.ts'
import type {
  DragDraft,
  DragGuide,
  DragModifiers,
  DragState,
  DragView,
} from './builder-drag.types.ts'
import type { BuilderPart, BuilderPartLine, Vector } from './ldraw-builder.types.ts'
import type { PointerPosition } from './ldraw-builder-page.types.ts'

// How near on the screen a connection pulls the part onto it.
export const SNAP_RADIUS = 40
const GUIDE_LENGTH = 400
const ORIGIN: Vector = [0, 0, 0]

// Each part's connections, worked out once its shape has arrived.
export const createConnectionLists = (
  getShape: (partName: string) => PartShape | undefined
): ((part: BuilderPartLine) => readonly PartConnection[]) => {
  const lists = new Map<string, readonly PartConnection[]>()
  return (part) => {
    const key = part.partName.toLowerCase()
    const known = lists.get(key)
    if (known !== undefined) return known
    const shape = getShape(part.partName)
    if (shape === undefined) return []
    const connections = getPartConnections(part.partName, shape)
    lists.set(key, connections)
    return connections
  }
}

export const getDragMode = (modifiers: DragModifiers): DragMode =>
  modifiers.isCommand ? DragMode.VERTICAL : modifiers.isShift ? DragMode.AXIS : DragMode.FREE

const getConnected = (
  parts: readonly BuilderPart[],
  isChosen: (index: number) => boolean,
  view: DragView
): readonly ConnectedPart[] =>
  parts
    .filter((_part, index) => isChosen(index))
    .map((part) => ({ part, connections: view.getConnections(part) }))

// The nearest connection the moving parts (where they are now) or the cursor come to, among the moves allowed.
export const findSnap = (
  parts: readonly BuilderPart[],
  indices: readonly number[],
  view: DragView,
  pointer: PointerPosition | null,
  getIsOffsetAllowed: (offset: Vector) => boolean
): ConnectionSnap | null =>
  findConnectionSnap(
    getConnected(parts, (index) => indices.includes(index), view),
    getConnected(parts, (index) => !indices.includes(index), view),
    {
      project: view.project,
      radius: SNAP_RADIUS,
      isTurnAllowed: indices.length === 1,
      groundHeight: view.snapContext.groundHeight,
      pointer: pointer === null ? null : view.toScreen(pointer),
      getIsOffsetAllowed,
    }
  )

const getHeight = (view: DragView, position: PointerPosition, grabbed: Vector): number | null => {
  const ray = view.getRay(position)
  return ray === null ? null : getRayHeight(ray.origin, ray.direction, grabbed)
}

// A drag begun (or a mode taken up) at the cursor with the selection grabbed at a point.
export const startDrag = (
  parts: readonly BuilderPart[],
  grabbed: Vector,
  position: PointerPosition,
  mode: DragMode,
  view: DragView
): DragState =>
  Object.freeze({
    mode,
    base: parts,
    grabbed,
    groundStart: view.getGroundPoint(position, grabbed[1]) ?? grabbed,
    heightStart: getHeight(view, position, grabbed),
    pointerStart: position,
    parts,
  })

// Where the grabbed point is now: moved as the first selected part moved since the mode began.
const getGrabbedNow = (state: DragState, indices: readonly number[]): Vector => {
  const index = indices[0] ?? -1
  const before = state.base[index]?.position ?? ORIGIN
  const after = state.parts[index]?.position ?? ORIGIN
  return addVectors(state.grabbed, getVectorDifference(after, before))
}

// LDraw units per pixel at the grabbed point, up the screen: how far a drag up moves when the camera looks straight down.
const getUnitsPerPixel = (view: DragView, grabbed: Vector): number => {
  const [, low] = view.project(grabbed)
  const [, high] = view.project(addVectors(grabbed, [0, -PLATE_HEIGHT, 0]))
  return PLATE_HEIGHT / Math.max(Math.abs(low - high), 1)
}

const getRise = (state: DragState, position: PointerPosition, view: DragView): number => {
  const height = getHeight(view, position, state.grabbed)
  return height !== null && state.heightStart !== null
    ? height - state.heightStart
    : (position.clientY - state.pointerStart.clientY) * getUnitsPerPixel(view, state.grabbed)
}

const getGuide = (point: Vector, step: Vector): DragGuide => ({
  from: getVectorDifference(point, step),
  to: addVectors(point, step),
})

const createDraft = (
  state: DragState,
  parts: readonly BuilderPart[],
  snap: ConnectionSnap | null,
  guide: DragGuide | null
): DragDraft =>
  Object.freeze({ state: Object.freeze({ ...state, parts }), target: snap?.target ?? null, guide })

// Up and down by whole plates, or onto a connection straight above or below when it is nearer than the plate.
const dragVertically = (
  state: DragState,
  indices: readonly number[],
  position: PointerPosition,
  view: DragView
): DragDraft => {
  const rise = getRise(state, position, view)
  const raw = moveParts(state.base, indices, [0, rise, 0])
  const plate = getPlateOffset(0, rise)
  const found = findSnap(raw, indices, view, position, getIsVertical)
  const snap =
    found !== null && Math.abs(found.offset[1]) <= Math.abs(plate[1] - rise) ? found : null
  const parts =
    snap === null ? moveParts(state.base, indices, plate) : applyConnectionSnap(raw, indices, snap)
  return createDraft(state, parts, snap, getGuide(state.grabbed, [0, GUIDE_LENGTH, 0]))
}

// Across the ground (held to one axis with ⇧): onto the nearest connection, else along the stud grid resting on what is under it.
const dragAcross = (
  state: DragState,
  indices: readonly number[],
  position: PointerPosition,
  view: DragView
): DragDraft => {
  const to = view.getGroundPoint(position, state.groundStart[1])
  if (to === null) return createDraft(state, state.parts, null, null)
  const free = getVectorDifference(to, state.groundStart)
  const axis = getDominantAxis(free)
  const isLocked = state.mode === DragMode.AXIS
  const offset = isLocked ? lockToAxis(free, axis) : ([free[0], 0, free[2]] as const)
  const raw = moveParts(state.base, indices, offset)
  const snap = findSnap(raw, indices, view, position, (snapOffset) =>
    isLocked ? getIsAlongAxis(addVectors(offset, snapOffset), axis) : true
  )
  const parts =
    snap === null
      ? dragSelection(state.base, indices, getStudOffset(ORIGIN, offset), view.snapContext)
      : applyConnectionSnap(raw, indices, snap)
  const step: Vector = axis === 0 ? [GUIDE_LENGTH, 0, 0] : [0, 0, GUIDE_LENGTH]
  return createDraft(state, parts, snap, isLocked ? getGuide(state.grabbed, step) : null)
}

// A step of the drag: a change of mode (⇧ or ⌘ pressed or let go) carries on from where the selection is.
export const updateDrag = (
  state: DragState,
  indices: readonly number[],
  position: PointerPosition,
  modifiers: DragModifiers,
  view: DragView
): DragDraft => {
  const mode = getDragMode(modifiers)
  const current =
    mode === state.mode
      ? state
      : startDrag(state.parts, getGrabbedNow(state, indices), position, mode, view)
  return mode === DragMode.VERTICAL
    ? dragVertically(current, indices, position, view)
    : dragAcross(current, indices, position, view)
}
