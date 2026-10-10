import type { CollisionObject } from '../../../collision/index.ts'
import {
  createFloatArithmetic,
  FpuPrecision,
  IDENTITY_MATRIX3,
} from '../../../simulation-math/index.ts'
import {
  CarRigidBodyFlag,
  createCarRigidBody,
  setWheelGeometry,
} from '../car-rigid-body/car-rigid-body.ts'
import { getWithTiltLimit, probeGround } from './ground-probe.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const NO_CHILD = 0xffff

const FLOOR: readonly CollisionObject[] = [
  {
    frame: { rotation: IDENTITY_MATRIX3, position: { x: 0, y: 0, z: 0 } },
    materialNames: undefined,
    volume: {
      nodes: [
        {
          normal: { x: 0, y: 0, z: 1 },
          firstTriangleIndex: 0,
          triangleCount: 2,
          positiveChildIndex: NO_CHILD,
          negativeChildIndex: NO_CHILD,
        },
      ],
      vertices: [
        { x: -100, y: -100, z: 0 },
        { x: 100, y: -100, z: 0 },
        { x: 100, y: 100, z: 0 },
        { x: -100, y: 100, z: 0 },
      ],
      triangles: [
        { vertexIndices: [0, 1, 2], materialIndex: 0 },
        { vertexIndices: [0, 2, 3], materialIndex: 0 },
      ],
      materialNames: ['road'],
    },
  },
]

// The same object without any geometry: only the triangle cache can find the floor.
const EMPTY_TRACK: readonly CollisionObject[] = FLOOR.map((object) => ({
  ...object,
  volume: { ...object.volume, nodes: [] },
}))

const createCar = (z: number) =>
  setWheelGeometry(
    SINGLE,
    createCarRigidBody(SINGLE, {
      displayFrame: { rotation: IDENTITY_MATRIX3, position: { x: 0, y: 0, z } },
      displayBoundingRadius: 5,
      mass: 1,
      dimensions: { x: 8, y: 5, z: 6.2 },
    }),
    { x: 3, y: 2, z: -1 },
    4,
    6
  )

describe('probeGround', () => {
  it('finds the floor under all four wheels, settles the frame and shares out the weight (0x00445dc0)', () => {
    // Arrange: an airborne probe ends at the anchor, so the anchors (z = -0.5) start below the floor.
    const car = createCar(0.5)
    const falling = {
      ...car,
      weight: -1,
      stepStart: { ...car.stepStart, position: { x: 0, y: 0, z: 0.5 } },
    }

    // Act
    const probed = probeGround(SINGLE, falling, 40, FLOOR)

    // Assert
    expect(probed.groundedWheelCount).toBe(4)
    expect(probed.groundNormal).toEqual({ x: 0, y: 0, z: 1 })
    expect(probed.frame.position.z).toBe(Math.fround(1.2))
    expect(probed.wheels.map((wheel) => wheel.groundForce.z)).toEqual(
      Array(4).fill(Math.fround(1 / 12))
    )
    expect(probed.slopeForce).toEqual({ x: 0, y: 0, z: 0 })
    expect(probed.triangleCache).toHaveLength(2)
  })

  it('reuses the cached triangle on the next probe', () => {
    // Arrange
    const car = createCar(0.5)
    const first = probeGround(
      SINGLE,
      { ...car, stepStart: { ...car.stepStart, position: { x: 0, y: 0, z: 0.5 } } },
      40,
      FLOOR
    )

    // Act
    const second = probeGround(SINGLE, first, 40, EMPTY_TRACK)

    // Assert
    expect(second.groundedWheelCount).toBe(4)
    expect(second.wheels.map((wheel) => wheel.cachedTriangleIndex)).toEqual([0, 0, 1, 1])
  })

  it('leaves a body at rest alone', () => {
    // Arrange
    const resting = { ...createCar(50), flags: CarRigidBodyFlag.AT_REST }

    // Act
    const probed = probeGround(SINGLE, resting, 40, FLOOR)

    // Assert
    expect(probed).toBe(resting)
  })
})

describe('getWithTiltLimit', () => {
  it('pulls rotation row 2 back to 45 degrees from the vertical (0x00445d10)', () => {
    // Arrange: rolled 90 degrees about x.
    const car = createCar(0)
    const rolled = {
      ...car,
      frame: { ...car.frame, rotation: [1, 0, 0, 0, 0, 1, 0, -1, 0] as const },
    }

    // Act
    const limited = getWithTiltLimit(SINGLE, rolled)

    // Assert
    expect(limited.frame.rotation[8]).toBeCloseTo(Math.SQRT1_2, 6)
    expect(limited.frame.rotation[7]).toBeCloseTo(-Math.SQRT1_2, 6)
  })
})
