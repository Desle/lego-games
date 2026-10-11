import type { ComputerRacerRoute } from '../../../computer-racer-route/index.ts'
import { UnportableRouteError } from '../racer-ai-errors/racer-ai-errors.ts'
import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import {
  advanceRouteFollower,
  createRouteFollower,
  moveRouteFollower,
  setRouteFollowerSpeedFactor,
  startRouteFollowerAtLoop,
} from './route-follower.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)

// Sample bytes are +4..+11: z offset, rotation x..w, lateral limits, timing (contact << 6 | duration / 32).
const ROUTE: ComputerRacerRoute = {
  firstVector: [0, 0, 0],
  firstQuaternion: [0, 0, 0, 1],
  secondVector: [10, 0, 0],
  secondQuaternion: [0, 0, 0, 1],
  firstInteger: 32,
  sampleIndex: 0,
  samples: [
    { first: 256, second: 0, bytes: [0, 0, 0, 0, 127, 8, 16, 0x01] },
    { first: 512, second: 0, bytes: [0, 0, 0, 0, 127, 24, 32, 0x42] },
  ],
  readByteCount: 0,
}

describe('advanceRouteFollower', () => {
  it('starts from the route start and interpolates toward the first sample', () => {
    // Arrange
    const follower = createRouteFollower(ROUTE, 1)

    // Act
    const advanced = advanceRouteFollower(SINGLE, follower, 16)

    // Assert
    expect(advanced.position).toEqual({ x: 0.5, y: 0, z: 0 })
    expect(advanced.contactState).toBe(4)
    expect(advanced.negativeLateralLimit).toBe(0.5)
    expect(advanced.positiveLateralLimit).toBe(1)
    expect(advanced.time).toBe(16)
  })

  it('moves to the next segment when the time reaches the next sample', () => {
    // Arrange
    const follower = advanceRouteFollower(SINGLE, createRouteFollower(ROUTE, 1), 16)

    // Act
    const advanced = advanceRouteFollower(SINGLE, follower, 16)

    // Assert
    expect(advanced.previousSampleIndex).toBe(0)
    expect(advanced.nextSampleIndex).toBe(1)
    expect(advanced.previousTime).toBe(32)
    expect(advanced.nextPosition).toEqual({ x: 3, y: 0, z: 0 })
    expect(advanced.position).toEqual({ x: 1, y: 0, z: 0 })
    expect(advanced.contactState).toBe(1)
  })

  it('wraps to the loop point without resetting the running next time (0x004a55ab)', () => {
    // Arrange
    const follower = advanceRouteFollower(SINGLE, createRouteFollower(ROUTE, 1), 32)

    // Act
    const advanced = advanceRouteFollower(SINGLE, follower, 168)

    // Assert
    expect(advanced.time).toBe(136)
    expect(advanced.previousTime).toBe(32)
    expect(advanced.nextPosition).toEqual({ x: 12, y: 0, z: 0 })
    expect(advanced.position.x).toBe(11.625)
  })

  it('stops at time 0 when going back before the first sample', () => {
    // Arrange
    const follower = setRouteFollowerSpeedFactor(
      advanceRouteFollower(SINGLE, createRouteFollower(ROUTE, 1), 32),
      -1
    )

    // Act
    const advanced = advanceRouteFollower(SINGLE, follower, 16)

    // Assert
    expect(advanced.time).toBe(0)
    expect(advanced.position.x).toBe(0)
  })

  it('leaves a follower without a route unchanged', () => {
    // Arrange
    const follower = createRouteFollower(null, 1)

    // Act
    const advanced = advanceRouteFollower(SINGLE, follower, 16)

    // Assert
    expect(advanced).toBe(follower)
  })
})

describe('startRouteFollowerAtLoop', () => {
  it('places the follower at the loop point with the loop sample’s limits', () => {
    // Arrange
    const follower = createRouteFollower(null, 1)

    // Act
    const started = startRouteFollowerAtLoop(SINGLE, follower, ROUTE)

    // Assert
    expect(started.position).toEqual({ x: 10, y: 0, z: 0 })
    expect(started.time).toBe(32)
    expect(started.nextSampleIndex).toBe(1)
    expect(started.nextPosition).toEqual({ x: 12, y: 0, z: 0 })
    expect(started.negativeLateralLimit).toBe(1)
  })

  it('refuses a loop sample outside the route', () => {
    // Arrange
    const route = { ...ROUTE, sampleIndex: 1 }

    // Act
    const start = (): unknown =>
      startRouteFollowerAtLoop(SINGLE, createRouteFollower(null, 1), route)

    // Assert
    expect(start).toThrow(UnportableRouteError)
  })
})

describe('moveRouteFollower, 0x004a5750', () => {
  const ZERO = { x: 0, y: 0, z: 0 }
  const createStarted = () => startRouteFollowerAtLoop(SINGLE, createRouteFollower(null, 1), ROUTE)

  it('keeps the follower where it is for a zero displacement', () => {
    // Arrange
    const follower = createStarted()

    // Act
    const { follower: moved, displacement } = moveRouteFollower(SINGLE, follower, ZERO)

    // Assert
    expect(moved.time).toBe(32)
    expect(moved.position).toEqual({ x: 10, y: 0, z: 0 })
    expect(moved.previousRotation).toEqual({ x: 0, y: 0, z: 0, w: 1 })
    expect(displacement).toEqual(ZERO)
  })

  it('moves along the segment by the part of the displacement in its direction', () => {
    // Arrange
    const follower = createStarted()

    // Act
    const { follower: moved, displacement } = moveRouteFollower(SINGLE, follower, {
      x: 1,
      y: 5,
      z: 0,
    })

    // Assert
    expect(moved.time).toBe(64)
    expect(moved.position).toEqual({ x: 11, y: 0, z: 0 })
    expect(displacement).toEqual({ x: 1, y: 5, z: 0 })
  })

  it('moves back along the segment for a displacement against its direction', () => {
    // Arrange
    const follower = advanceRouteFollower(SINGLE, createStarted(), 32)

    // Act
    const { follower: moved, displacement } = moveRouteFollower(SINGLE, follower, {
      x: -0.5,
      y: 0,
      z: 0,
    })

    // Assert
    expect(follower.position).toEqual({ x: 11, y: 0, z: 0 })
    expect(moved.position).toEqual({ x: 10.5, y: 0, z: 0 })
    expect(displacement).toEqual({ x: -0.5, y: 0, z: 0 })
  })

  it('leaves the follower and shortens the displacement when the route ends before the move does', () => {
    // Arrange
    const follower = createStarted()

    // Act
    const { follower: moved, displacement } = moveRouteFollower(SINGLE, follower, {
      x: 500,
      y: 0,
      z: 0,
    })

    // Assert
    expect(moved).toBe(follower)
    expect(displacement.x).toBeLessThan(500)
  })

  it('leaves a follower without a route alone', () => {
    // Arrange
    const follower = createRouteFollower(null, 1)

    // Act
    const { follower: moved } = moveRouteFollower(SINGLE, follower, ZERO)

    // Assert
    expect(moved).toBe(follower)
  })
})
