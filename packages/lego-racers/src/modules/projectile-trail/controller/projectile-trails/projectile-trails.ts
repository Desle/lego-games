import {
  createFloatArithmetic,
  getFloatFromBits,
  getNormalizedVector2,
  getTruncatedInteger,
  RACE_FPU_PRECISION,
  ZERO_VECTOR3,
} from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import type {
  ProjectileTrail,
  TrailAllocation,
  TrailColor,
  TrailDrawing,
  TrailMesh,
  TrailParameters,
  TrailPool,
  TrailRing,
  TrailSlot,
  TrailTriangle,
  TrailVertex,
} from '../../types/projectile-trail.types.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
const { add, subtract, multiply, divide, storeFloat, getIsEqual } = arithmetic

// 0x00493850 (called with 6 by Race_LoadTrackContent at 0x00433520): the trails of a race.
export const TRAIL_COUNT = 6
// float32 1.0 at 0x004af388
const ONE = getFloatFromBits(0x3f800000)
// float32 1/255 at 0x004b05d8
const INVERSE_BYTE_MAXIMUM = getFloatFromBits(0x3b808081)
// float32 255 at 0x004b09c0
const BYTE_MAXIMUM = getFloatFromBits(0x437f0000)
// float32 0.5 at 0x004af58c
const HALF = getFloatFromBits(0x3f000000)
// 0x00492a50 sizes the dynamic mesh for 0x6a points
const MAXIMUM_VERTICES = 0x6a
// 0x00492a50 sizes the index buffer for 0x35 triangles (the bound at 0x004935a0 is 0xd4 bytes)
const MAXIMUM_TRIANGLES = 0x35
// 0x004931a0 (at 0x004934b6) indexes at most 0x40 points
const MAXIMUM_INDEXED_VERTICES = 0x40
// 0x00492ae0: a trail keeps two slots more than its ring size.
const SLOTS_BEYOND_RING_SIZE = 2
const BYTE_MASK = 0xff
const FREE_COLOR: TrailColor = Object.freeze({ red: 0, green: 0, blue: 0, alpha: 0 })

const createSlot = (verticesPerRing: number): TrailSlot =>
  Object.freeze({
    milliseconds: 0,
    vertices: Object.freeze(Array.from({ length: verticesPerRing }, () => ZERO_VECTOR3)),
    center: ZERO_VECTOR3,
  })

const createFreeTrail = (): ProjectileTrail =>
  Object.freeze({
    isActive: false,
    isReleasing: false,
    isAwaitingFirstRing: false,
    isAgeing: false,
    isBuilt: false,
    durationMilliseconds: 0,
    sliceMilliseconds: 0,
    writeIndex: 0,
    readIndex: 0,
    ringSize: 0,
    slotCount: 0,
    verticesPerRing: 0,
    fadeFactor: 0,
    alphaReduction: 0,
    color: FREE_COLOR,
    materialName: '',
    slots: Object.freeze([]),
    mesh: null,
  })

export const createTrailPool = (): TrailPool =>
  Object.freeze({ trails: Object.freeze(Array.from({ length: TRAIL_COUNT }, createFreeTrail)) })

// 0x00492ae0 Trail_Start.
const getStartedTrail = (parameters: TrailParameters): ProjectileTrail => {
  const sliceMilliseconds = Math.floor(parameters.durationMilliseconds / parameters.ringSize)
  const slotCount = parameters.ringSize + SLOTS_BEYOND_RING_SIZE
  return Object.freeze({
    isActive: true,
    isReleasing: false,
    isAwaitingFirstRing: true,
    isAgeing: false,
    isBuilt: false,
    durationMilliseconds: parameters.ringSize * sliceMilliseconds,
    sliceMilliseconds,
    writeIndex: 0,
    readIndex: 0,
    ringSize: parameters.ringSize,
    slotCount,
    verticesPerRing: parameters.verticesPerRing,
    fadeFactor: parameters.fadeFactor,
    alphaReduction: parameters.alphaReduction,
    color: parameters.color,
    materialName: parameters.materialName,
    slots: Object.freeze(
      Array.from({ length: slotCount }, () => createSlot(parameters.verticesPerRing))
    ),
    mesh: null,
  })
}

const getPoolWithTrail = (pool: TrailPool, index: number, trail: ProjectileTrail): TrailPool =>
  Object.freeze({
    trails: Object.freeze(
      pool.trails.map((current, position) => (position === index ? trail : current))
    ),
  })

// 0x004939b0 Trails_Take: the first trail not in use.
export const takeTrail = (pool: TrailPool, parameters: TrailParameters): TrailAllocation => {
  const index = pool.trails.findIndex((trail) => !trail.isActive)
  if (index < 0) return Object.freeze({ pool, index: null })
  return Object.freeze({ pool: getPoolWithTrail(pool, index, getStartedTrail(parameters)), index })
}

const getWithSlot = (
  slots: readonly TrailSlot[],
  index: number,
  slot: TrailSlot
): readonly TrailSlot[] =>
  Object.freeze(slots.map((current, position) => (position === index ? slot : current)))

const getSlot = (slots: readonly TrailSlot[], index: number): TrailSlot => {
  const slot = slots[index]
  if (slot === undefined)
    throw new RangeError(`Trail slot ${String(index)} of ${String(slots.length)}`)
  return slot
}

const getNextIndex = (trail: ProjectileTrail, index: number): number =>
  index + 1 === trail.slotCount ? 0 : index + 1

// The milliseconds of the slots after `readIndex` up to and including the write slot (a do-while: it runs at least once).
const getSlotTotal = (
  trail: ProjectileTrail,
  slots: readonly TrailSlot[],
  readIndex: number
): number => {
  let index = readIndex
  let total = 0
  do {
    index = getNextIndex(trail, index)
    total = (total + getSlot(slots, index).milliseconds) >>> 0
  } while (index !== trail.writeIndex)
  return total
}

const getLerped = (current: number, next: number, fraction: number): number =>
  storeFloat(add(multiply(subtract(next, current), fraction), current))

const getLerpedPoint = (current: Vector3, next: Vector3, fraction: number): Vector3 =>
  Object.freeze({
    x: getLerped(current.x, next.x, fraction),
    y: getLerped(current.y, next.y, fraction),
    z: getLerped(current.z, next.z, fraction),
  })

// 0x00492c30 Trail_Advance: the oldest slot gives up its milliseconds and its points move toward the next slot's.
const getAdvancedTrail = (trail: ProjectileTrail, milliseconds: number): ProjectileTrail => {
  let { readIndex, slots, isAgeing } = trail
  let total = getSlotTotal(trail, slots, readIndex)
  if (!isAgeing && trail.durationMilliseconds < total) isAgeing = true
  if (!isAgeing || milliseconds === 0) return Object.freeze({ ...trail, isAgeing })
  let remaining = milliseconds >>> 0
  for (;;) {
    let rest = 0
    if (trail.sliceMilliseconds < remaining) {
      rest = remaining - trail.sliceMilliseconds
      remaining = trail.sliceMilliseconds
    }
    let nextIndex = getNextIndex(trail, readIndex)
    if (remaining !== 0) {
      const held = getSlot(slots, nextIndex).milliseconds
      if (held <= remaining) {
        slots = getWithSlot(slots, nextIndex, { ...getSlot(slots, nextIndex), milliseconds: 0 })
        remaining -= held
        readIndex = nextIndex
        nextIndex = getNextIndex(trail, readIndex)
      }
      total = getSlotTotal(trail, slots, readIndex)
      if (remaining !== 0 && total !== 0) {
        const next = getSlot(slots, nextIndex)
        if (next.milliseconds < remaining) remaining = (next.milliseconds - 1) >>> 0
        const fraction = storeFloat(divide(remaining | 0, next.milliseconds | 0))
        const oldest = getSlot(slots, readIndex)
        slots = getWithSlot(
          getWithSlot(slots, nextIndex, {
            ...next,
            milliseconds: (next.milliseconds - remaining) >>> 0,
          }),
          readIndex,
          {
            ...oldest,
            vertices: Object.freeze(
              oldest.vertices.map((point, position) =>
                getLerpedPoint(point, next.vertices[position] ?? point, fraction)
              )
            ),
            center: getLerpedPoint(oldest.center, next.center, fraction),
          }
        )
      }
    }
    if (trail.isReleasing && (readIndex === trail.writeIndex || total === 0)) {
      // The flags are cleared (the trail is free); its slots stay as they are.
      return Object.freeze({
        ...trail,
        readIndex,
        slots,
        isActive: false,
        isReleasing: false,
        isAwaitingFirstRing: false,
        isAgeing: false,
        isBuilt: false,
      })
    }
    remaining = rest
    if (rest === 0) break
  }
  return Object.freeze({ ...trail, readIndex, slots, isAgeing })
}

const getByteStep = (trail: ProjectileTrail): number => {
  const fraction = subtract(multiply(trail.color.alpha, INVERSE_BYTE_MAXIMUM), trail.alphaReduction)
  const step = multiply(divide(fraction, trail.ringSize + 1), BYTE_MAXIMUM)
  return getTruncatedInteger(step) & BYTE_MASK
}

// A point moved toward the ring's centre; the y and z differences are stored before they scale.
const getFadedPoint = (point: Vector3, center: Vector3, fraction: number): Vector3 =>
  Object.freeze({
    x: storeFloat(add(multiply(subtract(center.x, point.x), fraction), point.x)),
    y: storeFloat(add(multiply(storeFloat(subtract(center.y, point.y)), fraction), point.y)),
    z: storeFloat(add(multiply(storeFloat(subtract(center.z, point.z)), fraction), point.z)),
  })

const getRingFraction = (trail: ProjectileTrail, elapsed: number): number =>
  storeFloat(
    multiply(subtract(ONE, trail.fadeFactor), divide(elapsed | 0, trail.durationMilliseconds | 0))
  )

const getIndexedTriangles = (
  verticesPerRing: number,
  indexedRings: number
): readonly TrailTriangle[] => {
  const triangles: TrailTriangle[] = []
  const addTriangle = (first: number, second: number, third: number) => {
    if (triangles.length < MAXIMUM_TRIANGLES) {
      triangles.push(Object.freeze({ first, second, third }))
    }
  }
  for (let ring = 0; ring + 1 < indexedRings; ring += 1) {
    const base = verticesPerRing * ring
    for (let index = 0; index < verticesPerRing; index += 1) {
      const nextIndex = (index + 1) % verticesPerRing
      addTriangle(verticesPerRing + base + index, base + index, verticesPerRing + base + nextIndex)
      addTriangle(verticesPerRing + base + nextIndex, base + index, base + nextIndex)
    }
  }
  if (verticesPerRing > 2) {
    const base = verticesPerRing * Math.max(indexedRings - 1, 0)
    for (let index = 1; index < verticesPerRing - 1; index += 1) {
      addTriangle(base, base + index, base + index + 1)
    }
  }
  return Object.freeze(triangles)
}

// 0x004931a0 Trail_BuildMesh: the rings, newest first, as points with the u across a ring and the v along the trail,
// joined by two triangles per pair of neighbouring points and closed at the oldest ring.
export const getTrailMesh = (trail: ProjectileTrail): TrailMesh => {
  const { readIndex, writeIndex, slotCount, verticesPerRing } = trail
  const ringCount =
    writeIndex > readIndex ? writeIndex - readIndex + 1 : slotCount - readIndex + 1 + writeIndex
  const newest = getSlot(trail.slots, writeIndex)
  const origin: Vector3 = Object.freeze({
    x: newest.vertices[0]?.x ?? 0,
    y: newest.vertices[1]?.y ?? 0,
    z: newest.vertices[2]?.z ?? 0,
  })
  const step = getByteStep(trail)
  const uStep = storeFloat(divide(ONE, verticesPerRing + 1))
  const vStep = storeFloat(divide(ONE, trail.ringSize + 1))
  const vertices: TrailVertex[] = []
  let elapsed = 0
  let alpha = trail.color.alpha
  let v = 0
  for (let ring = 0; ring < ringCount; ring += 1) {
    const slot = getSlot(trail.slots, (slotCount - ring + writeIndex) % slotCount)
    const fraction = ring === 0 ? 0 : getRingFraction(trail, elapsed)
    if (ring !== 0) alpha = (alpha - step) & BYTE_MASK
    const color: TrailColor = Object.freeze({ ...trail.color, alpha })
    let u = 0
    for (const stored of slot.vertices) {
      if (vertices.length < MAXIMUM_VERTICES) {
        const point =
          trail.fadeFactor !== ONE && !getIsEqual(fraction, 0)
            ? getFadedPoint(stored, slot.center, fraction)
            : stored
        vertices.push(
          Object.freeze({
            position: Object.freeze({
              x: storeFloat(subtract(point.x, origin.x)),
              y: storeFloat(subtract(point.y, origin.y)),
              z: storeFloat(subtract(point.z, origin.z)),
            }),
            u,
            v,
            color,
          })
        )
      }
      u = storeFloat(add(u, uStep))
    }
    v = storeFloat(add(v, vStep))
    elapsed = (elapsed + slot.milliseconds) >>> 0
  }
  const indexedRings = Math.min(Math.floor(MAXIMUM_INDEXED_VERTICES / verticesPerRing), ringCount)
  return Object.freeze({
    origin,
    vertices: Object.freeze(vertices),
    triangles: getIndexedTriangles(verticesPerRing, indexedRings),
  })
}

const getTrailWithMesh = (trail: ProjectileTrail): ProjectileTrail =>
  Object.freeze({ ...trail, mesh: getTrailMesh(trail) })

const getSlotWithRing = (milliseconds: number, ring: TrailRing): TrailSlot =>
  Object.freeze({ milliseconds, vertices: ring.vertices, center: ring.center })

// One pass of the loop of Trail_PushRingTimed: the milliseconds fill the newest slot, the oldest age away, and a full
// slot hands over to the next, which takes the ring.
const getTrailWithSlice = (
  trail: ProjectileTrail,
  milliseconds: number,
  ring: TrailRing
): ProjectileTrail => {
  const newest = getSlot(trail.slots, trail.writeIndex)
  const filled = getAdvancedTrail(
    Object.freeze({
      ...trail,
      slots: getWithSlot(trail.slots, trail.writeIndex, {
        ...newest,
        milliseconds: (newest.milliseconds + milliseconds) >>> 0,
      }),
    }),
    milliseconds
  )
  let { writeIndex, slots } = filled
  let held = getSlot(slots, writeIndex).milliseconds
  if (filled.sliceMilliseconds <= held) {
    slots = getWithSlot(slots, writeIndex, {
      ...getSlot(slots, writeIndex),
      milliseconds: filled.sliceMilliseconds,
    })
    held = (held - filled.sliceMilliseconds) >>> 0
    writeIndex = getNextIndex(filled, writeIndex)
    if (filled.sliceMilliseconds < held) held = filled.sliceMilliseconds
  }
  return Object.freeze({
    ...filled,
    writeIndex,
    slots: getWithSlot(slots, writeIndex, getSlotWithRing(held, ring)),
  })
}

// 0x00492f10 Trail_PushRingTimed.
const getTrailWithRing = (
  trail: ProjectileTrail,
  milliseconds: number,
  ring: TrailRing
): ProjectileTrail => {
  if (trail.isAwaitingFirstRing) {
    const held = getSlot(trail.slots, trail.writeIndex).milliseconds
    return Object.freeze({
      ...trail,
      isAwaitingFirstRing: false,
      writeIndex: trail.writeIndex + 1,
      slots: getWithSlot(trail.slots, trail.writeIndex, getSlotWithRing(held, ring)),
    })
  }
  let current = trail
  let remaining = milliseconds >>> 0
  while (remaining !== 0) {
    const limit = (current.sliceMilliseconds - 1) >>> 0
    let rest = 0
    let slice = remaining
    if (limit < remaining) {
      rest = (remaining - current.sliceMilliseconds) >>> 0
      slice = limit
    }
    current = getTrailWithSlice(current, slice, ring)
    remaining = rest
  }
  return Object.freeze({ ...getTrailWithMesh(current), isBuilt: true })
}

// 0x00492ee0 Trail_PushRing.
export const pushTrailRing = (
  pool: TrailPool,
  index: number,
  milliseconds: number,
  ring: TrailRing
): TrailPool => {
  const trail = pool.trails[index]
  return trail === undefined || !trail.isActive
    ? pool
    : getPoolWithTrail(pool, index, getTrailWithRing(trail, milliseconds, ring))
}

// 0x00492bd0 (through 0x00493a10): the trail is let go and its rings age out.
export const releaseTrail = (pool: TrailPool, index: number): TrailPool => {
  const trail = pool.trails[index]
  return trail === undefined || !trail.isActive
    ? pool
    : getPoolWithTrail(pool, index, Object.freeze({ ...trail, isReleasing: true }))
}

// 0x00492be0 Trail_Update: only a released trail ages (a trail still awaiting its first ring never does).
const getUpdatedTrail = (trail: ProjectileTrail, milliseconds: number): ProjectileTrail => {
  if (!trail.isActive || trail.isAwaitingFirstRing || !trail.isReleasing) return trail
  const advanced = getAdvancedTrail(Object.freeze({ ...trail, isAgeing: true }), milliseconds)
  return advanced.isActive ? getTrailWithMesh(advanced) : advanced
}

// 0x00493a20 Trails_Update.
export const stepTrailPool = (pool: TrailPool, milliseconds: number): TrailPool =>
  Object.freeze({
    trails: Object.freeze(pool.trails.map((trail) => getUpdatedTrail(trail, milliseconds))),
  })

// 0x00493aa0 Trails_Draw: the trails whose mesh was built.
export const getTrailDrawings = (pool: TrailPool): readonly TrailDrawing[] =>
  pool.trails.flatMap((trail) =>
    trail.isActive && trail.isBuilt && trail.mesh !== null
      ? [Object.freeze({ materialName: trail.materialName, mesh: trail.mesh })]
      : []
  )

// The ring of four points round a ball (the tails of 0x00451b50 and 0x004568f0): `size` wide across the horizontal
// perpendicular of its velocity and tall along z; null when the velocity has no horizontal part.
export const getBallTrailRing = (
  position: Vector3,
  velocity: Vector3,
  size: number
): TrailRing | null => {
  if (getIsEqual(velocity.y, 0) && getIsEqual(-velocity.x, 0)) return null
  const unit = getNormalizedVector2(arithmetic, { x: velocity.y, y: -velocity.x })
  const widthX = storeFloat(multiply(size, unit.x))
  const widthY = storeFloat(multiply(unit.y, size))
  const startX = storeFloat(subtract(position.x, multiply(widthX, HALF)))
  const startY = storeFloat(subtract(position.y, multiply(widthY, HALF)))
  const top = storeFloat(add(multiply(size, HALF), position.z))
  const bottom = storeFloat(subtract(top, size))
  const endX = storeFloat(add(startX, widthX))
  const endY = storeFloat(add(startY, widthY))
  const endTop = storeFloat(add(bottom, size))
  return Object.freeze({
    vertices: Object.freeze([
      Object.freeze({ x: startX, y: startY, z: top }),
      Object.freeze({ x: startX, y: startY, z: bottom }),
      Object.freeze({ x: endX, y: endY, z: bottom }),
      Object.freeze({ x: endX, y: endY, z: endTop }),
    ]),
    center: position,
  })
}
