import { rotateVector } from '../builder-document/builder-document.ts'
import { getNearestAxis, PART_UP } from '../builder-rotation/builder-rotation.ts'
import { PLATE_HEIGHT, STUD_WIDTH } from '../ldraw-units/ldraw-units.constants.ts'
import type { FootprintGrid, PartShape, PartStud } from '../builder-studs/builder-studs.types.ts'
import type {
  BuilderBox,
  BuilderPart,
  BuilderPartLine,
  PlacementTarget,
  Vector,
} from '../../types/building.types.ts'

const FACING = 0.5
const FACING_STUD = 0.99
const STUD_HEIGHT = 4
const STUD_RADIUS = 6
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

const HALF_STUD = STUD_WIDTH / 2

const getDot = (first: Vector, second: Vector): number =>
  first[0] * second[0] + first[1] * second[1] + first[2] * second[2]

const getDifference = (first: Vector, second: Vector): Vector => [
  first[0] - second[0],
  first[1] - second[1],
  first[2] - second[2],
]

const getIsUpward = (direction: Vector) => direction[1] < -FACING_STUD

// The upward studs of a part turned as it is, in its frame, the top ones first.
const getUpwardStuds = (studs: readonly PartStud[], rotation: readonly number[]) =>
  studs
    .map((stud) => ({
      position: rotateVector(rotation, stud.position),
      direction: rotateVector(rotation, stud.direction),
    }))
    .filter((stud) => getIsUpward(stud.direction))
    .sort((first, second) => first.position[1] - second.position[1])

const getIsInside = (point: Vector, box: BuilderBox) =>
  point[0] > box.minimum[0] &&
  point[0] < box.maximum[0] &&
  point[2] > box.minimum[2] &&
  point[2] < box.maximum[2]

const getIsUpright = (rotation: readonly number[]) => getIsUpward(rotateVector(rotation, PART_UP))

// Where the anti-studs of a footprint are across, on one axis: its extent made whole studs (a tile's and a round part's bottom face is
// a little in from its sides); null when it is not a whole number of studs wide (a clip, a bracket's edge).
const getFootprintCentres = (minimum: number, maximum: number): number | null => {
  const start = Math.round(minimum / HALF_STUD) * HALF_STUD
  const width = Math.round(maximum / HALF_STUD) * HALF_STUD - start
  return width >= STUD_WIDTH && width % STUD_WIDTH === 0 ? start + HALF_STUD : null
}

// A stud centre of a box as many studs wide as it nearly is, from its middle (half a stud off it for an even count): the same grid
// whichever way the box is turned, so a part without studs (a wheel) does not wander as it turns.
const getBoxStudCentre = (minimum: number, maximum: number): number => {
  const count = Math.max(1, Math.round((maximum - minimum) / STUD_WIDTH))
  return (minimum + maximum) / 2 + (count % 2 === 0 ? HALF_STUD : 0)
}

const getFootprintGrid = (
  footprint: BuilderBox | null,
  rotation: readonly number[]
): FootprintGrid | null => {
  if (footprint === null) return null
  const turned = getRotatedBox(footprint, rotation)
  const x = getFootprintCentres(turned.minimum[0], turned.maximum[0])
  const z = getFootprintCentres(turned.minimum[2], turned.maximum[2])
  if (x === null || z === null) return null
  const getCount = (axis: number) =>
    Math.round(((turned.maximum[axis] ?? 0) - (turned.minimum[axis] ?? 0)) / STUD_WIDTH)
  return { point: [x, turned.maximum[1], z], count: getCount(0) * getCount(2), box: turned }
}

// Where the part in hand meets the stud grid, from its origin, turned as it is: across, the centre of one of its anti-studs (under
// one of its top studs, or for a part whose few studs sit between its anti-studs, a jumper, where its footprint puts them); along, the
// base of its top studs. A part without upward studs goes by its footprint (a tile), a part on its side by its box. A box corner is off
// the grid for a part that overhangs (handles, clips, wheel pins).
export const getGridPoint = (
  shape: PartShape,
  box: BuilderBox,
  rotation: readonly number[]
): Vector => {
  const upward = getUpwardStuds(shape.studs, rotation)
  const footprint = getIsUpright(rotation) ? getFootprintGrid(shape.footprint, rotation) : null
  const [top] = upward
  if (top !== undefined) {
    const isJumper =
      footprint !== null &&
      upward.length < footprint.count &&
      upward.every((stud) => getIsInside(stud.position, footprint.box)) &&
      upward.every(
        (stud) =>
          getRemainder(stud.position[0] - footprint.point[0], STUD_WIDTH) !== 0 ||
          getRemainder(stud.position[2] - footprint.point[2], STUD_WIDTH) !== 0
      )
    return isJumper ? [footprint.point[0], top.position[1], footprint.point[2]] : top.position
  }
  if (footprint !== null) return [footprint.point[0], 0, footprint.point[2]]
  const turned = getRotatedBox(box, rotation)
  const studWay = getNearestAxis(rotateVector(rotation, PART_UP))
  const getAxis = (axis: number) =>
    studWay[axis] === 0 ? getBoxStudCentre(turned.minimum[axis] ?? 0, turned.maximum[axis] ?? 0) : 0
  return [getAxis(0), getAxis(1), getAxis(2)]
}

// How far down from its origin the part in hand stands, turned as it is: an upright part with studs on what is under them (handles,
// clips and wheel pins beside them hang lower), else on its box's bottom.
export const getPartBottom = (
  shape: PartShape,
  box: BuilderBox,
  rotation: readonly number[]
): number =>
  getIsUpright(rotation) && shape.bottom !== null
    ? shape.bottom
    : getRotatedBox(box, rotation).maximum[1]

// The stud of a placed part the cursor is nearest to, turned as the part is (its top studs may stand at several levels and, on a
// jumper, off its anti-studs); a part without upward studs offers its box: half a stud in from its corner across, its top.
export const getTopGridPoint = (
  studs: readonly PartStud[],
  box: BuilderBox,
  part: BuilderPartLine,
  point: Vector
): Vector => {
  const local = getDifference(point, part.position)
  const getDistance = (position: Vector) => Math.hypot(...getDifference(local, position))
  const nearest = getUpwardStuds(studs, part.rotation).sort(
    (first, second) => getDistance(first.position) - getDistance(second.position)
  )[0]
  if (nearest !== undefined) return nearest.position
  const turned = getRotatedBox(box, part.rotation)
  return [
    getBoxStudCentre(turned.minimum[0], turned.maximum[0]),
    turned.minimum[1],
    getBoxStudCentre(turned.minimum[2], turned.maximum[2]),
  ]
}

// The grid a placed part offers: its stud centres across (as the remainder of the corner half a stud before one, so the ground's 0
// is a grid of whole studs), the top of its body (its studs' base) by a plate upward.
export const getPartPhase = (gridPoint: Vector, part: BuilderPartLine): Vector => [
  getRemainder(part.position[0] + gridPoint[0] - HALF_STUD, STUD_WIDTH),
  getRemainder(part.position[1] + gridPoint[1], PLATE_HEIGHT),
  getRemainder(part.position[2] + gridPoint[2] - HALF_STUD, STUD_WIDTH),
]

export const getGroundPhase = (groundHeight: number): Vector => [
  0,
  getRemainder(groundHeight, PLATE_HEIGHT),
  0,
]

// The position along an axis that puts the part's grid point on a stud centre of the phase, its box as near to centred on the cursor
// as that allows.
const snapAcross = (
  centre: number,
  minimum: number,
  maximum: number,
  phase: number,
  gridPoint: number
): number => {
  const onGrid = phase + HALF_STUD - gridPoint
  return onGrid + STUD_WIDTH * Math.round((centre - (minimum + maximum) / 2 - onGrid) / STUD_WIDTH)
}

// Where a part goes for the face the cursor is on (LDraw's y points down): on a top face its bottom stands on the body under the
// cursor, under a bottom face its origin meets it, beside a side face it stands next to it, the bottom on the plate level below the
// cursor. Across, its studs fall on the stud grid of the part under the cursor, as near to centred on the cursor as it gets.
export const getPlacementPosition = (
  target: PlacementTarget,
  box: BuilderBox,
  gridPoint: Vector,
  bottom: number
): Vector => {
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
  const height = level - (isBottom ? gridPoint[1] : bottom)
  return [
    snapAcross(getPushed(0, normalX), box.minimum[0], box.maximum[0], phaseX, gridPoint[0]),
    height,
    snapAcross(getPushed(2, normalZ), box.minimum[2], box.maximum[2], phaseZ, gridPoint[2]),
  ]
}

// A placed part's studs in the editing frame.
export const getPlacedStuds = (
  studs: readonly PartStud[],
  part: BuilderPartLine
): readonly PartStud[] =>
  studs.map((stud) => {
    const turned = rotateVector(part.rotation, stud.position)
    return Object.freeze({
      position: [
        turned[0] + part.position[0],
        turned[1] + part.position[1],
        turned[2] + part.position[2],
      ] as const,
      direction: rotateVector(part.rotation, stud.direction),
    })
  })

// The stud a part in hand goes onto when that stud does not point up: the one the cursor is on (its top, side, base or an open
// stud's hole), else the nearest on the face under the cursor when that face carries studs pointing out of it. Upward studs keep the
// plain placement.
export const findSideStud = (
  studs: readonly PartStud[],
  point: Vector,
  normal: Vector
): PartStud | null => {
  const sideStuds = studs.filter((stud) => stud.direction[1] > -FACING_STUD)
  const getAlong = (stud: PartStud) => getDot(getDifference(point, stud.position), stud.direction)
  const getAcross = (stud: PartStud) => {
    const offset = getDifference(point, stud.position)
    const along = getAlong(stud)
    return Math.hypot(
      offset[0] - along * stud.direction[0],
      offset[1] - along * stud.direction[1],
      offset[2] - along * stud.direction[2]
    )
  }
  const onStud = sideStuds.find(
    (stud) =>
      getAlong(stud) > -STUD_HEIGHT - STUD_TOLERANCE &&
      getAlong(stud) < STUD_HEIGHT + STUD_TOLERANCE &&
      getAcross(stud) < STUD_RADIUS + STUD_TOLERANCE
  )
  if (onStud !== undefined) return onStud
  const onFace = sideStuds
    .filter(
      (stud) =>
        getDot(stud.direction, normal) > FACING_STUD && Math.abs(getAlong(stud)) < STUD_TOLERANCE
    )
    .sort((first, second) => getAcross(first) - getAcross(second))
  return onFace[0] ?? null
}

// Where a part whose studs already point the stud's way goes: its bottom on the stud's face, its anti-studs (under its studs) on that
// face's stud grid, as near to centred on the cursor as it gets.
export const getSideStudPosition = (
  point: Vector,
  stud: PartStud,
  box: BuilderBox,
  gridPoint: Vector
): Vector => {
  const outward = getNearestAxis(stud.direction)
  const getAxisPosition = (axis: number): number => {
    const direction = outward[axis] ?? 0
    const studAt = stud.position[axis] ?? 0
    const minimum = box.minimum[axis] ?? 0
    const maximum = box.maximum[axis] ?? 0
    if (direction > 0) return studAt - minimum
    if (direction < 0) return studAt - maximum
    return snapAcross(
      point[axis] ?? 0,
      minimum,
      maximum,
      getRemainder(studAt - HALF_STUD, STUD_WIDTH),
      gridPoint[axis] ?? 0
    )
  }
  return [getAxisPosition(0), getAxisPosition(1), getAxisPosition(2)]
}
