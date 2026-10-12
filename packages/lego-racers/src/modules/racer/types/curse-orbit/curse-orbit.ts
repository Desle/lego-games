import {
  getBlendedQuaternion,
  getDotProduct,
  getFloatFromBits,
  getMatrixFromQuaternion,
  getNormalizedVector3,
  getQuaternionFromMatrix,
  getRotationFromFrameAxes,
} from '../../../simulation-math/index.ts'
import type { Matrix3, Vector3 } from '../../../simulation-math/index.ts'
import { getTableCosine } from '../cosine-table/cosine-table.ts'
import type {
  CurseFigure,
  CurseFigureFrame,
  CurseOrbit,
  CurseOrbitInput as OrbitInput,
} from './curse-orbit.types.ts'

// 0x0043f54c: the orbit clock starts again at 1000 ms (the blend starts at the same at 0x0043e17a).
const CLOCK_MILLISECONDS = 1000
// 0x004c6b34, set by 0x0043d590: a turn (2 pi) per clock.
const CLOCK_RADIANS = getFloatFromBits(0x3bcde32e)
// 0x004b02f4: the table has 1024 entries a turn, read backwards.
const TABLE_INDEX_SCALE = getFloatFromBits(0xc322f983)
// 0x004b0b48: the same, forwards.
const TABLE_INDEX_SCALE_FORWARD = getFloatFromBits(0x4322f983)
// 0x0043f5ae: the index wraps within the 1024 entries.
const TABLE_SIZE_MASK = 0x3ff
// 0x0043f5a7: the backward index is shifted a quarter turn.
const TABLE_QUARTER_TURN = 0x100
// 0x004b0b10: the figure circles 6 from the car.
const ORBIT_RADIUS = 6
// 0x004b0b14: and 9 above its display position.
const ORBIT_HEIGHT = 9
// 0x004b0b0c: the figure moves at the car's speed, at least this fast.
const MINIMUM_SPEED = getFloatFromBits(0x3dcccccd)
// 0x004af6fc: milliseconds to the blend's share.
const MILLISECOND_SCALE = getFloatFromBits(0x3a83126f)
// 0x004b0b18: the figure shrinks 0.01 a millisecond ...
const SHRINK_FIRST_FACTOR = getFloatFromBits(0x3c23d70a)
// 0x004b0b1c: ... times 0.066 ...
const SHRINK_SECOND_FACTOR = getFloatFromBits(0x3d872b02)
// 0x004b0b20: ... down to this scale.
const SMALLEST_SCALE = getFloatFromBits(0x3f2a7efa)
const WORLD_UP: Vector3 = Object.freeze({ x: 0, y: 0, z: 1 })

export const INITIAL_CURSE_ORBIT: CurseOrbit = Object.freeze({
  clockMilliseconds: 0,
  blendMilliseconds: 0,
  figure: null,
})

// 0x00439900: the figure takes the frame it is given at full scale, its clip 0 at the start.
export const getCurseOrbitWithFigure = (orbit: CurseOrbit, frame: CurseFigureFrame): CurseOrbit =>
  Object.freeze({
    ...orbit,
    figure: Object.freeze({
      position: frame.position,
      rotation: frame.rotation,
      scale: 1,
      animationMilliseconds: 0,
    }),
  })

// 0x00439b00 lets the figure go.
export const getCurseOrbitWithoutFigure = (orbit: CurseOrbit): CurseOrbit =>
  Object.freeze({ ...orbit, figure: null })

// 0x0043e17a: an update without the curse starts the blend over.
export const getCurseOrbitIdle = (orbit: CurseOrbit): CurseOrbit =>
  orbit.blendMilliseconds === CLOCK_MILLISECONDS
    ? orbit
    : Object.freeze({ ...orbit, blendMilliseconds: CLOCK_MILLISECONDS })

// Where the figure is drawn this update, a float32 point on the circle round the car, reached at the car's speed.
const getFigurePosition = (input: OrbitInput, figure: CurseFigure, clock: number): Vector3 => {
  const { arithmetic, tables, carPosition, carSpeed, stepMilliseconds } = input
  const { add, subtract, multiply, storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  const angle = multiply(clock, CLOCK_RADIANS)
  const sine = getTableCosine(
    tables,
    (-Math.trunc(multiply(angle, TABLE_INDEX_SCALE)) - TABLE_QUARTER_TURN) & TABLE_SIZE_MASK
  )
  const cosine = getTableCosine(
    tables,
    Math.trunc(multiply(angle, TABLE_INDEX_SCALE_FORWARD)) & TABLE_SIZE_MASK
  )
  const targetX = add(multiply(ORBIT_RADIUS, sine), carPosition.x)
  const targetY = storeFloat(add(multiply(ORBIT_RADIUS, cosine), carPosition.y))
  const targetZ = storeFloat(add(ORBIT_HEIGHT, carPosition.z))
  const speed = getIsBelowOrEqual(carSpeed, MINIMUM_SPEED) ? MINIMUM_SPEED : carSpeed
  const reach = storeFloat(multiply(stepMilliseconds, speed))
  const { position } = figure
  const differenceX = subtract(position.x, targetX)
  const differenceY = subtract(position.y, targetY)
  const differenceZ = subtract(position.z, targetZ)
  const distanceSquared = add(
    add(multiply(differenceZ, differenceZ), multiply(differenceY, differenceY)),
    multiply(differenceX, differenceX)
  )
  if (!getIsBelow(multiply(reach, reach), distanceSquared)) {
    return Object.freeze({ x: storeFloat(targetX), y: targetY, z: targetZ })
  }
  const direction = getNormalizedVector3(arithmetic, {
    x: storeFloat(subtract(targetX, position.x)),
    y: storeFloat(subtract(targetY, position.y)),
    z: storeFloat(subtract(targetZ, position.z)),
  })
  return Object.freeze({
    x: storeFloat(add(multiply(direction.x, reach), position.x)),
    y: storeFloat(add(storeFloat(multiply(direction.y, reach)), position.y)),
    z: storeFloat(add(storeFloat(multiply(direction.z, reach)), position.z)),
  })
}

// The figure faces along the circle: its first axis is the horizontal turn away from the car, its third the world's up.
const getFigureRotation = (
  input: OrbitInput,
  figure: CurseFigure,
  position: Vector3,
  blend: number
): Matrix3 => {
  const { arithmetic, carPosition } = input
  const { subtract, multiply, storeFloat } = arithmetic
  const toCar = getNormalizedVector3(arithmetic, {
    x: storeFloat(subtract(carPosition.x, position.x)),
    y: storeFloat(subtract(carPosition.y, position.y)),
    z: storeFloat(subtract(carPosition.z, position.z)),
  })
  const first = getNormalizedVector3(arithmetic, {
    x: storeFloat(subtract(multiply(toCar.z, WORLD_UP.y), multiply(toCar.y, WORLD_UP.z))),
    y: storeFloat(subtract(multiply(WORLD_UP.z, toCar.x), multiply(toCar.z, WORLD_UP.x))),
    z: storeFloat(subtract(multiply(toCar.y, WORLD_UP.x), multiply(WORLD_UP.y, toCar.x))),
  })
  if (blend === 0) return getRotationFromFrameAxes(arithmetic, { first, third: WORLD_UP })
  const normalizedFirst = getNormalizedVector3(arithmetic, first)
  const overlap = getDotProduct(arithmetic, normalizedFirst, WORLD_UP)
  const third = getNormalizedVector3(arithmetic, {
    x: storeFloat(subtract(WORLD_UP.x, storeFloat(multiply(normalizedFirst.x, overlap)))),
    y: storeFloat(subtract(WORLD_UP.y, storeFloat(multiply(normalizedFirst.y, overlap)))),
    z: storeFloat(subtract(WORLD_UP.z, multiply(overlap, normalizedFirst.z))),
  })
  const second = {
    x: storeFloat(subtract(multiply(first.z, third.y), multiply(first.y, third.z))),
    y: storeFloat(subtract(multiply(third.z, first.x), multiply(first.z, third.x))),
    z: storeFloat(subtract(multiply(first.y, third.x), multiply(third.y, first.x))),
  }
  const target: Matrix3 = [
    first.x,
    first.y,
    first.z,
    second.x,
    second.y,
    second.z,
    third.x,
    third.y,
    third.z,
  ]
  const fraction = storeFloat(multiply(blend, MILLISECOND_SCALE))
  return getMatrixFromQuaternion(
    arithmetic,
    getBlendedQuaternion(
      arithmetic,
      getQuaternionFromMatrix(arithmetic, figure.rotation),
      getQuaternionFromMatrix(arithmetic, target),
      fraction
    )
  )
}

// 0x0043f530 (thiscall on the vehicle: milliseconds), run by Vehicle_Update while the racer carries the curse: the clock and
// the blend count down, the figure moves toward its place on the circle and turns, shrinks to two thirds of its size, and
// plays on.
export const stepCurseOrbit = (orbit: CurseOrbit, input: OrbitInput): CurseOrbit => {
  const { arithmetic, stepMilliseconds } = input
  const { subtract, multiply, storeFloat, getIsBelow, getIsBelowOrEqual } = arithmetic
  const clockMilliseconds =
    stepMilliseconds > orbit.clockMilliseconds
      ? CLOCK_MILLISECONDS
      : orbit.clockMilliseconds - stepMilliseconds
  const blendMilliseconds =
    stepMilliseconds > orbit.blendMilliseconds ? 0 : orbit.blendMilliseconds - stepMilliseconds
  const { figure } = orbit
  if (figure === null) return Object.freeze({ ...orbit, clockMilliseconds, blendMilliseconds })
  const position = getFigurePosition(input, figure, clockMilliseconds)
  const rotation = getFigureRotation(input, figure, position, blendMilliseconds)
  const shrunk = subtract(
    figure.scale,
    multiply(multiply(stepMilliseconds, SHRINK_FIRST_FACTOR), SHRINK_SECOND_FACTOR)
  )
  const scale = getIsBelowOrEqual(figure.scale, SMALLEST_SCALE)
    ? figure.scale
    : storeFloat(getIsBelow(shrunk, SMALLEST_SCALE) ? SMALLEST_SCALE : shrunk)
  return Object.freeze({
    clockMilliseconds,
    blendMilliseconds,
    figure: Object.freeze({
      position,
      rotation,
      scale,
      animationMilliseconds: figure.animationMilliseconds + stepMilliseconds,
    }),
  })
}
