import type { CollisionObject, SegmentQueryResult } from '../../../collision/index.ts'
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
import type { CarRigidBody, SegmentQuery } from '../racer-physics.types.ts'
import {
  getBodyInTwoPointMode,
  getBodyOutOfTwoPointMode,
  getBodyWithTwoPointOffsets,
  getBodyWithTwoPointPositions,
  getBodyWithTwoPointTargetTilt,
  probeTwoPoints,
} from './two-point-mode.ts'

const arithmetic = createFloatArithmetic(FpuPrecision.SINGLE)
const ORIGIN = { x: 0, y: 0, z: 0 }

const createBody = (change: Partial<CarRigidBody> = {}): CarRigidBody =>
  Object.freeze({
    ...setWheelGeometry(
      arithmetic,
      createCarRigidBody(arithmetic, {
        displayFrame: { rotation: IDENTITY_MATRIX3, position: { x: 0, y: 0, z: 10 } },
        displayBoundingRadius: 2,
        mass: 1000,
        dimensions: { x: 1, y: 1, z: 1 },
      }),
      { x: 1, y: 1, z: 0 },
      2,
      4
    ),
    flags: CarRigidBodyFlag.TWO_POINT,
    weight: -10,
    ...change,
  })

const GROUND_HIT: SegmentQueryResult = {
  lastCrossingPoint: { x: 0, y: 0, z: 9 },
  intersection: {
    point: { x: 0, y: 0, z: 9 },
    fraction: 0.5,
    materialIndex: 0,
    triangle: {
      vertices: [ORIGIN, ORIGIN, ORIGIN],
      normal: { x: 0, y: 0, z: 1 },
      planeDistance: 0,
    },
  },
}
const MISS: SegmentQueryResult = { intersection: undefined, lastCrossingPoint: undefined }

const createTrack = (): CollisionObject => ({
  frame: { rotation: IDENTITY_MATRIX3, position: ORIGIN },
  volume: { nodes: [], vertices: [], triangles: [], materialNames: ['road'] },
  materialNames: undefined,
})

const queryAlways =
  (result: SegmentQueryResult): SegmentQuery =>
  () =>
    result

// The ground at z = 9 under whichever point asks.
const queryGround: SegmentQuery = (_arithmetic, _volume, start) => {
  const point = { x: start.x, y: start.y, z: 9 }
  return {
    lastCrossingPoint: point,
    intersection:
      GROUND_HIT.intersection === undefined ? undefined : { ...GROUND_HIT.intersection, point },
  }
}

describe('the two-point mode', () => {
  it('leans toward the side of the turn by a quarter turn halved less the share of 4096 (0x00448840)', () => {
    // Arrange
    const right = createBody({ turnRadius: 1024 })
    const left = createBody({ turnRadius: -1024 })
    const straight = createBody({ turnRadius: 0 })

    // Act
    const rightTilt = getBodyWithTwoPointTargetTilt(arithmetic, right).twoPointTargetTilt
    const leftTilt = getBodyWithTwoPointTargetTilt(arithmetic, left).twoPointTargetTilt
    const straightTilt = getBodyWithTwoPointTargetTilt(arithmetic, straight).twoPointTargetTilt

    // Assert
    expect(rightTilt).toBeCloseTo(-0.75 * (Math.PI / 4), 5)
    expect(leftTilt).toBeCloseTo(0.75 * (Math.PI / 4), 5)
    expect(straightTilt).toBe(0)
  })

  it('moves the height and the tilt toward their targets and stops there (0x004464a0)', () => {
    // Arrange
    const body = createBody({
      twoPointHeight: 0,
      twoPointTargetHeight: 6,
      twoPointHeightRate: 3,
      twoPointTilt: 0.1,
      twoPointTargetTilt: -0.2,
    })

    // Act
    const stepped = getBodyWithTwoPointOffsets(arithmetic, body, 20)
    const settled = getBodyWithTwoPointOffsets(arithmetic, stepped, 5000)

    // Assert
    expect(stepped.twoPointHeight).toBeCloseTo(0.06, 5)
    expect(stepped.twoPointTilt).toBeCloseTo(0, 5)
    expect(settled.twoPointHeight).toBe(6)
    expect(settled.twoPointTilt).toBe(-0.2)
  })

  it('sets the points at the midpoints of the front and the rear wheel pairs (0x00448660)', () => {
    // Arrange
    const body = createBody()

    // Act
    const positioned = getBodyWithTwoPointPositions(arithmetic, body)

    // Assert
    expect(positioned.twoPointPositions[0]).toEqual({ x: 1, y: 0, z: 10 })
    expect(positioned.twoPointPositions[1]).toEqual({ x: -3, y: 0, z: 10 })
  })

  it('enters and leaves the mode with the height and tilts back to 0 (0x00448660, 0x00448730)', () => {
    // Arrange
    const body = createBody({ flags: 0, twoPointHeight: 3, twoPointTilt: 1 })

    // Act
    const entered = getBodyInTwoPointMode(arithmetic, body)
    const left = getBodyOutOfTwoPointMode(entered)

    // Assert
    expect(entered.flags & CarRigidBodyFlag.TWO_POINT).toBe(CarRigidBodyFlag.TWO_POINT)
    expect(entered.twoPointHeight).toBe(0)
    expect(entered.pitchTimer).toBe(150)
    expect(left.flags & CarRigidBodyFlag.TWO_POINT).toBe(0)
  })

  it('finds no ground and sinks 0.008 when the points had ground before (0x004465c0)', () => {
    // Arrange
    const body = createBody({ groundedWheelCount: 2 })

    // Act
    const probed = probeTwoPoints(arithmetic, body, 16, [createTrack()], queryAlways(MISS))

    // Assert
    expect(probed.groundedWheelCount).toBe(0)
    expect(probed.linearVelocity.z).toBeCloseTo(-0.008, 5)
  })

  it('puts the frame on the deepest contact and loads half the weight on each point (0x004465c0)', () => {
    // Arrange
    const body = createBody({ groundedWheelCount: 2 })

    // Act
    const probed = probeTwoPoints(arithmetic, body, 16, [createTrack()], queryGround)

    // Assert
    expect(probed.groundedWheelCount).toBe(2)
    expect(probed.frame.position.z).toBeCloseTo(9, 4)
    expect(probed.wheels[0]?.groundForce).toEqual({ x: 0, y: 0, z: 5 })
    expect(probed.wheels[1]?.groundForce).toEqual({ x: 0, y: 0, z: 5 })
    expect(probed.groundNormal.z).toBeCloseTo(1, 4)
  })

  it('removes the velocity into the ground on a landing and bounces 1.3 times above 0.05 (0x004465c0)', () => {
    // Arrange
    const soft = createBody({ groundedWheelCount: 0, linearVelocity: { x: 0, y: 0, z: -0.03 } })
    const hard = createBody({ groundedWheelCount: 0, linearVelocity: { x: 0, y: 0, z: -0.1 } })

    // Act
    const landed = probeTwoPoints(arithmetic, soft, 16, [createTrack()], queryGround)
    const bounced = probeTwoPoints(arithmetic, hard, 16, [createTrack()], queryGround)

    // Assert
    expect(landed.linearVelocity.z).toBeCloseTo(0, 5)
    expect(landed.groundedWheelCount).toBe(2)
    expect(bounced.linearVelocity.z).toBeCloseTo(0.03, 5)
    expect(bounced.groundedWheelCount).toBe(0)
  })

  it('leaves a body at rest alone', () => {
    // Arrange
    const body = createBody({ flags: CarRigidBodyFlag.TWO_POINT | CarRigidBodyFlag.AT_REST })

    // Act
    const probed = probeTwoPoints(arithmetic, body, 16, [createTrack()], queryGround)

    // Assert
    expect(probed).toBe(body)
  })
})
