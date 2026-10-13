import { rotateVector } from './builder-document.ts'
import type { BuilderBox, BuilderPart, PlacementTarget, Vector } from './ldraw-builder.types.ts'

export const STUD_WIDTH = 20
export const PLATE_HEIGHT = 8
const FACING = 0.5
const CLEARANCE = 0.01
// A stud stands 4 LDU above a part's body: a point on a stud's top still counts as the body's top.
const STUD_TOLERANCE = 0.5

const getRemainder = (value: number, step: number): number => ((value % step) + step) % step

const getCorners = (box: BuilderBox): readonly Vector[] =>
  [0, 1, 2, 3, 4, 5, 6, 7].map((corner) => [
    corner & 1 ? box.maximum[0] : box.minimum[0],
    corner & 2 ? box.maximum[1] : box.minimum[1],
    corner & 4 ? box.maximum[2] : box.minimum[2],
  ])

const getBoxOf = (points: readonly Vector[]): BuilderBox => {
  const getAxis = (axis: number) => points.map((point) => point[axis] ?? 0)
  return Object.freeze({
    minimum: [Math.min(...getAxis(0)), Math.min(...getAxis(1)), Math.min(...getAxis(2))] as const,
    maximum: [Math.max(...getAxis(0)), Math.max(...getAxis(1)), Math.max(...getAxis(2))] as const,
  })
}

// A part's box (in its own frame) turned by a rotation.
export const getRotatedBox = (box: BuilderBox, rotation: readonly number[]): BuilderBox =>
  getBoxOf(getCorners(box).map((corner) => rotateVector(rotation, corner)))

// Where a placed part's box is in the editing frame.
export const getPlacedBox = (box: BuilderBox, part: BuilderPart): BuilderBox => {
  const turned = getRotatedBox(box, part.rotation)
  const move = (point: Vector): Vector => [
    point[0] + part.position[0],
    point[1] + part.position[1],
    point[2] + part.position[2],
  ]
  return Object.freeze({ minimum: move(turned.minimum), maximum: move(turned.maximum) })
}

// The grid a placed part sits on: its box's corner by a stud across, its origin (the top of a brick's body) by a plate upward.
export const getPartPhase = (box: BuilderBox, part: BuilderPart): Vector => {
  const placed = getPlacedBox(box, part)
  return [
    getRemainder(placed.minimum[0], STUD_WIDTH),
    getRemainder(part.position[1], PLATE_HEIGHT),
    getRemainder(placed.minimum[2], STUD_WIDTH),
  ]
}

export const getGroundPhase = (groundHeight: number): Vector => [
  0,
  getRemainder(groundHeight, PLATE_HEIGHT),
  0,
]

const snapAcross = (centre: number, minimum: number, maximum: number, phase: number): number => {
  const corner =
    phase + STUD_WIDTH * Math.round((centre - (maximum - minimum) / 2 - phase) / STUD_WIDTH)
  return corner - minimum
}

// Where a part goes for the face the cursor is on (LDraw's y points down): on a top face its bottom stands on the body under the
// cursor, under a bottom face its origin meets it, beside a side face it stands next to it, the bottom on the plate level below the
// cursor. Across, its box's corner falls on the stud grid of the part under the cursor, as near to centred on the cursor as it gets.
export const getPlacementPosition = (target: PlacementTarget, box: BuilderBox): Vector => {
  const [normalX, normalY, normalZ] = target.normal
  const isTop = normalY < -FACING
  const isBottom = normalY > FACING
  const isSide = !isTop && !isBottom
  const getPushed = (axis: number, normal: number) =>
    isSide
      ? (target.point[axis] ?? 0) +
        normal * (((box.maximum[axis] ?? 0) - (box.minimum[axis] ?? 0)) / 2 + CLEARANCE)
      : (target.point[axis] ?? 0)
  const [phaseX, phaseY, phaseZ] = target.phase
  const pointY = target.point[1]
  const level = isTop
    ? phaseY + PLATE_HEIGHT * Math.ceil((pointY - STUD_TOLERANCE - phaseY) / PLATE_HEIGHT)
    : isBottom
      ? phaseY + PLATE_HEIGHT * Math.round((pointY - phaseY) / PLATE_HEIGHT)
      : phaseY + PLATE_HEIGHT * Math.ceil((pointY - phaseY) / PLATE_HEIGHT - CLEARANCE)
  return [
    snapAcross(getPushed(0, normalX), box.minimum[0], box.maximum[0], phaseX),
    isBottom ? level : level - box.maximum[1],
    snapAcross(getPushed(2, normalZ), box.minimum[2], box.maximum[2], phaseZ),
  ]
}
