import type { CollisionObject, CollisionVolume } from '../../../collision/index.ts'
import {
  createFloatArithmetic,
  FpuPrecision,
  IDENTITY_MATRIX3,
} from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import { setThrottle } from '../car-commands/car-commands.ts'
import {
  CarRigidBodyFlag,
  createCarRigidBody,
  setHullPoint,
  setWheelGeometry,
} from '../car-rigid-body/car-rigid-body.ts'
import { TwoPointModeNotPortedError } from '../two-point-mode/two-point-mode.ts'
import type { CarRigidBody } from '../racer-physics.types.ts'
import { stepCarRigidBody } from './rigid-body-step.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const NO_CHILD = 0xffff
const STEP = 40

// A floor at z = 0 for x < 20, and a wall at x = 20 facing -x (its node is the root).
const FLOOR_AND_WALL: CollisionVolume = {
  nodes: [
    {
      normal: { x: -1, y: 0, z: 0 },
      firstTriangleIndex: 2,
      triangleCount: 2,
      positiveChildIndex: 1,
      negativeChildIndex: NO_CHILD,
    },
    {
      normal: { x: 0, y: 0, z: 1 },
      firstTriangleIndex: 0,
      triangleCount: 2,
      positiveChildIndex: NO_CHILD,
      negativeChildIndex: NO_CHILD,
    },
  ],
  vertices: [
    { x: -1000, y: -1000, z: 0 },
    { x: 20, y: -1000, z: 0 },
    { x: 20, y: 1000, z: 0 },
    { x: -1000, y: 1000, z: 0 },
    { x: 20, y: 1000, z: -10 },
    { x: 20, y: -1000, z: -10 },
    { x: 20, y: -1000, z: 50 },
    { x: 20, y: 1000, z: 50 },
  ],
  triangles: [
    { vertexIndices: [0, 1, 2], materialIndex: 0 },
    { vertexIndices: [0, 2, 3], materialIndex: 0 },
    { vertexIndices: [4, 5, 6], materialIndex: 1 },
    { vertexIndices: [4, 6, 7], materialIndex: 1 },
  ],
  materialNames: ['road', 'wall'],
}

const getTrack = (volume: CollisionVolume): readonly CollisionObject[] => [
  {
    frame: { rotation: IDENTITY_MATRIX3, position: { x: 0, y: 0, z: 0 } },
    volume,
    materialNames: undefined,
  },
]

// The box 0x004371c0 passes (8, 5, 6.2), wheels 4 apart across and 6 along, a hull at the corners.
const createCar = (position: Vector3): CarRigidBody => {
  const body = setWheelGeometry(
    SINGLE,
    createCarRigidBody(SINGLE, {
      displayFrame: { rotation: IDENTITY_MATRIX3, position },
      displayBoundingRadius: 5,
      mass: 1,
      dimensions: { x: 8, y: 5, z: 6.2 },
    }),
    { x: 3, y: 2, z: -1 },
    4,
    6
  )
  const corners = [
    { x: 3, y: -2, z: 0 },
    { x: 3, y: 2, z: 0 },
    { x: -3, y: -2, z: 0 },
    { x: -3, y: 2, z: 0 },
  ]
  return corners.reduce((car, corner, index) => setHullPoint(SINGLE, car, index, corner), body)
}

const runSteps = (
  body: CarRigidBody,
  collisionObjects: readonly CollisionObject[],
  count: number
): CarRigidBody =>
  Array.from({ length: count }).reduce<CarRigidBody>(
    (current) => stepCarRigidBody(SINGLE, current, { stepMilliseconds: STEP, collisionObjects }),
    body
  )

describe('stepCarRigidBody', () => {
  it('lets an airborne body fall with four times gravity (0x00445587) and counts the air time', () => {
    // Arrange
    const car = createCar({ x: 0, y: 0, z: 100 })
    const weight = Math.fround(-39 * Math.fround(Math.fround(0.001) * Math.fround(0.001) * 1))
    const force = Math.fround(weight * 4)
    const velocityChange = Math.fround(Math.fround(force * STEP) * 1)
    const drop = Math.fround(
      Math.fround(Math.fround(0 * STEP) + Math.fround(20 * velocityChange)) + 100
    )

    // Act
    const fallen = stepCarRigidBody(SINGLE, car, { stepMilliseconds: STEP, collisionObjects: [] })

    // Assert
    expect(fallen.linearVelocity).toEqual({ x: 0, y: 0, z: velocityChange })
    expect(fallen.frame.position).toEqual({ x: 0, y: 0, z: drop })
    expect(fallen.weight).toBe(weight)
    expect(fallen.airborneTime).toBe(STEP)
    expect(fallen.groundedWheelCount).toBe(0)
  })

  it('lands on a floor with all four wheels and settles 0.2 above its anchors', () => {
    // Arrange
    const car = createCar({ x: 0, y: 0, z: 3 })

    // Act
    const landed = runSteps(car, getTrack(FLOOR_AND_WALL), 15)

    // Assert
    expect(landed.groundedWheelCount).toBe(4)
    expect(landed.frame.position).toEqual({ x: 0, y: 0, z: Math.fround(1.2) })
    expect(landed.wheels.map((wheel) => [wheel.isOnGround, wheel.material])).toEqual([
      [true, 'road'],
      [true, 'road'],
      [true, 'road'],
      [true, 'road'],
    ])
    expect(landed.airborneTime).toBe(0)
    expect(landed.triangleCache.length).toBeGreaterThan(0)
  })

  it('stops at the wall: a hull contact turns the car away and it never passes x = 20', () => {
    // Arrange
    const parked = runSteps(createCar({ x: 0, y: 0, z: 3 }), getTrack(FLOOR_AND_WALL), 15)
    const driving = setThrottle(SINGLE, parked, 20)

    // Act
    const states = Array.from({ length: 120 }).reduce<readonly CarRigidBody[]>(
      (history) => [
        ...history,
        stepCarRigidBody(SINGLE, history.at(-1) ?? driving, {
          stepMilliseconds: STEP,
          collisionObjects: getTrack(FLOOR_AND_WALL),
        }),
      ],
      [driving]
    )

    // Assert
    const touching = states.filter((state) => state.contactCount > 0)
    expect(touching.length).toBeGreaterThan(0)
    expect(touching.every((state) => (state.flags & CarRigidBodyFlag.WALL_TURN) !== 0)).toBe(true)
    expect(
      Math.max(...states.flatMap((state) => state.worldHullPoints.map((point) => point.x)))
    ).toBeLessThan(20.5)
  })

  it('stops with an error instead of running the unported two-point mode', () => {
    // Arrange
    const car = createCar({ x: 0, y: 0, z: 100 })
    const twoPoint = { ...car, flags: CarRigidBodyFlag.TWO_POINT }

    // Act
    const step = () =>
      stepCarRigidBody(SINGLE, twoPoint, { stepMilliseconds: STEP, collisionObjects: [] })

    // Assert
    expect(step).toThrow(TwoPointModeNotPortedError)
  })
})
