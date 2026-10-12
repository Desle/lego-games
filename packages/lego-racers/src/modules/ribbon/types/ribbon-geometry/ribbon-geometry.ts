import {
  getFrameInverseRotatedVector,
  getFrameTransformedPoint,
  getNormalizedVector3,
  getRotationFromFrameAxes,
  getStoredDifference,
} from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Frame, Vector3 } from '../../../simulation-math/index.ts'
import type {
  RibbonColor,
  RibbonCorner,
  RibbonRequest,
  RibbonSegment,
  RibbonShape,
} from '../ribbon.types.ts'

// 0x004b47a4: a segment shorter than the square root of this is not laid (0x00494870, 0x00494140).
const MINIMUM_SQUARED_SEGMENT_LENGTH = Math.fround(0.02)
// 0x004af58c: half.
const HALF = 0.5
const WORLD_UP: Vector3 = Object.freeze({ x: 0, y: 0, z: 1 })
const ALTERNATIVE_UP: Vector3 = Object.freeze({ x: 1, y: 0, z: 0 })
// 0x004b47a4 compares squares; 0x004af388 is the 1.0 of the dot product test in 0x00493ea0.
const PARALLEL_DOT = 1

type Ring = {
  // Each vertex in its segment's frame: the ring's centre, the vertex offset and the jitter.
  readonly locals: readonly Vector3[]
  readonly color: RibbonColor
  readonly v: number
  readonly bone: number
}

type Bone = {
  // Where the segment starts and how it points, in the ribbon figure's own frame (0x00494030).
  readonly frame: Frame
}

type RibbonBuild = {
  readonly rings: Ring[]
  readonly bones: Bone[]
  readonly pairs: [number, number][]
}

type PlacedRing = {
  readonly center: Vector3
  readonly color: RibbonColor
  readonly jitter: Vector3 | null
}

type ColoredPoint = {
  readonly point: Vector3
  readonly color: RibbonColor
}

const getLerpedByte = (arithmetic: FloatArithmetic, from: number, to: number, t: number): number =>
  (from + Math.trunc(arithmetic.multiply(to - from, t))) & 0xff

// 0x00494ad0 (cdecl: from, to, from colour, to colour, t): the point and the four colour bytes a fraction t along.
const getLerpedPoint = (
  arithmetic: FloatArithmetic,
  from: ColoredPoint,
  to: ColoredPoint,
  t: number
): ColoredPoint => {
  const { add, subtract, multiply, storeFloat } = arithmetic
  const difference = Object.freeze({
    x: storeFloat(subtract(to.point.x, from.point.x)),
    y: storeFloat(subtract(to.point.y, from.point.y)),
    z: subtract(to.point.z, from.point.z),
  })
  const color: RibbonColor = Object.freeze([
    getLerpedByte(arithmetic, from.color[0], to.color[0], t),
    getLerpedByte(arithmetic, from.color[1], to.color[1], t),
    getLerpedByte(arithmetic, from.color[2], to.color[2], t),
    getLerpedByte(arithmetic, from.color[3], to.color[3], t),
  ])
  return Object.freeze({
    point: Object.freeze({
      x: storeFloat(add(storeFloat(multiply(t, difference.x)), from.point.x)),
      y: storeFloat(add(storeFloat(multiply(difference.y, t)), from.point.y)),
      z: storeFloat(add(multiply(difference.z, t), from.point.z)),
    }),
    color,
  })
}

// 0x00493ea0: the ribbon's figure frame has its first axis along the request's direction and its third along up, or
// along the first world axis when the direction is (anti)parallel to up.
const getFigureFrame = (arithmetic: FloatArithmetic, request: RibbonRequest): Frame => {
  const direction = getNormalizedVector3(arithmetic, request.direction)
  const { add, multiply } = arithmetic
  const dot = add(
    add(multiply(direction.z, WORLD_UP.z), multiply(direction.y, WORLD_UP.y)),
    multiply(direction.x, WORLD_UP.x)
  )
  const isParallel = dot >= PARALLEL_DOT || dot <= -PARALLEL_DOT
  return Object.freeze({
    rotation: getRotationFromFrameAxes(arithmetic, {
      first: direction,
      third: isParallel ? ALTERNATIVE_UP : WORLD_UP,
    }),
    position: request.begin,
  })
}

const getVertexLocals = (
  arithmetic: FloatArithmetic,
  shape: RibbonShape,
  center: Vector3,
  jitter: Vector3 | null
): readonly Vector3[] =>
  shape.vertexOffsets.map((offset) => {
    const { add, storeFloat } = arithmetic
    const sum = Object.freeze({
      x: add(offset.x, center.x),
      y: add(offset.y, center.y),
      z: add(offset.z, center.z),
    })
    return Object.freeze({
      x: storeFloat(jitter === null ? sum.x : add(sum.x, jitter.x)),
      y: storeFloat(jitter === null ? sum.y : add(sum.y, jitter.y)),
      z: storeFloat(jitter === null ? sum.z : add(sum.z, jitter.z)),
    })
  })

// 0x00494290 for the ring, 0x00494480 for the strip between it and the one before it, then the wrap of the texture's v
// (0x00494870: a ring repeated at v 0 when the counter passes the wrap, except after the last ring of a segment).
const addRing = (
  arithmetic: FloatArithmetic,
  shape: RibbonShape,
  build: RibbonBuild,
  ring: PlacedRing,
  counter: number,
  isLastOfSegment: boolean
): number => {
  const locals = getVertexLocals(arithmetic, shape, ring.center, ring.jitter)
  const bone = build.bones.length
  build.rings.push({ locals, color: ring.color, v: counter, bone })
  build.pairs.push([build.rings.length - 1, build.rings.length - 2])
  if (!shape.isWrapped) return counter
  const next = counter + 1
  if (next <= shape.wrapRingCount) return next
  if (!isLastOfSegment) {
    build.rings.push({ locals, color: ring.color, v: 0, bone })
  }
  return 1
}

const getSegmentRings = (
  arithmetic: FloatArithmetic,
  shape: RibbonShape,
  segment: RibbonSegment,
  length: number
): readonly PlacedRing[] => {
  const { multiply, divide, add, storeFloat } = arithmetic
  const getJitter = (index: number): Vector3 | null => segment.jitter?.[index] ?? null
  const endColor = shape.endColor
  const end: ColoredPoint = { point: { x: length, y: 0, z: 0 }, color: endColor }
  const lastRing = {
    center: end.point,
    color: endColor,
    jitter: getJitter(shape.ringsPerSegment - 1),
  }
  if (shape.ringsPerSegment < 2) return [{ ...lastRing, jitter: getJitter(0) }]
  const start: ColoredPoint = { point: { x: 0, y: 0, z: 0 }, color: endColor }
  const control: ColoredPoint = {
    point: { x: storeFloat(multiply(length, HALF)), y: segment.bulge, z: 0 },
    color: segment.bulge <= 0 ? shape.negativeControlColor : shape.positiveControlColor,
  }
  const step = storeFloat(divide(1, shape.ringsPerSegment))
  const inner: PlacedRing[] = []
  let t = 0
  for (let index = 0; index < shape.ringsPerSegment - 1; index++) {
    t = storeFloat(add(t, step))
    const first = getLerpedPoint(arithmetic, start, control, t)
    const second = getLerpedPoint(arithmetic, control, end, t)
    const ring = getLerpedPoint(arithmetic, first, second, t)
    inner.push({ center: ring.point, color: ring.color, jitter: getJitter(index) })
  }
  return [...inner, lastRing]
}

// The ribbon of 0x00493c90 as triangles in the world: rings of vertices along a chain of segments (0x00494870), each
// segment a bone whose frame starts at the previous end and points along the segment (0x00494030). The skin puts every
// vertex through its bone and then the figure's frame.
export const getRibbonCorners = (
  arithmetic: FloatArithmetic,
  shape: RibbonShape,
  request: RibbonRequest
): readonly RibbonCorner[] => {
  const figure = getFigureFrame(arithmetic, request)
  const build: RibbonBuild = { rings: [], bones: [], pairs: [] }
  let counter = 1
  const firstRing = {
    center: { x: 0, y: 0, z: 0 },
    color: shape.endColor,
    jitter: request.initialJitter,
  }
  build.rings.push({
    locals: getVertexLocals(arithmetic, shape, firstRing.center, firstRing.jitter),
    color: firstRing.color,
    v: 0,
    bone: 0,
  })
  let previousEnd = request.begin
  for (const segment of request.segments) {
    const delta = getStoredDifference(arithmetic, segment.end, previousEnd)
    const squaredLength = arithmetic.add(
      arithmetic.add(arithmetic.multiply(delta.x, delta.x), arithmetic.multiply(delta.y, delta.y)),
      arithmetic.multiply(delta.z, delta.z)
    )
    if (squaredLength < MINIMUM_SQUARED_SEGMENT_LENGTH) continue
    const length = arithmetic.getSquareRoot(squaredLength)
    const rings = getSegmentRings(arithmetic, shape, segment, length)
    const startInFigure = getFrameInverseRotatedVector(
      arithmetic,
      figure,
      getStoredDifference(arithmetic, previousEnd, request.begin)
    )
    const directionInFigure = getFrameInverseRotatedVector(arithmetic, figure, delta)
    const bone: Bone = Object.freeze({
      frame: Object.freeze({
        rotation: getRotationFromFrameAxes(arithmetic, {
          first: directionInFigure,
          third: WORLD_UP,
        }),
        position: startInFigure,
      }),
    })
    for (const [index, ring] of rings.entries()) {
      counter = addRing(arithmetic, shape, build, ring, counter, index === rings.length - 1)
    }
    build.bones.push(bone)
    previousEnd = segment.end
  }
  return getCorners(arithmetic, shape, build, figure)
}

const getCorners = (
  arithmetic: FloatArithmetic,
  shape: RibbonShape,
  build: RibbonBuild,
  figure: Frame
): readonly RibbonCorner[] => {
  const getCorner = (ringIndex: number, vertexIndex: number): RibbonCorner => {
    const ring = build.rings[ringIndex]
    const bone = build.bones[ring?.bone ?? 0]
    const local = ring?.locals[vertexIndex]
    if (ring === undefined || bone === undefined || local === undefined) {
      throw new MissingRibbonVertexError(ringIndex, vertexIndex)
    }
    const inFigure = getFrameTransformedPoint(arithmetic, bone.frame, local)
    return Object.freeze({
      position: getFrameTransformedPoint(arithmetic, figure, inFigure),
      u: shape.textureU[vertexIndex] ?? 0,
      v: ring.v,
      color: ring.color,
    })
  }
  const corners: RibbonCorner[] = []
  for (const [current, previous] of build.pairs) {
    for (let cell = 0; cell < shape.vertexOffsets.length - 1; cell++) {
      // 0x00494480 writes the cell's triangles as (previous, current + 1, current) and (previous, previous + 1,
      // current + 1).
      corners.push(
        getCorner(previous, cell),
        getCorner(current, cell + 1),
        getCorner(current, cell),
        getCorner(previous, cell),
        getCorner(previous, cell + 1),
        getCorner(current, cell + 1)
      )
    }
  }
  return Object.freeze(corners)
}

export class MissingRibbonVertexError extends Error {
  constructor(ring: number, vertex: number) {
    super(`The ribbon has no vertex ${String(vertex)} on ring ${String(ring)}`)
    this.name = 'MissingRibbonVertexError'
  }
}
