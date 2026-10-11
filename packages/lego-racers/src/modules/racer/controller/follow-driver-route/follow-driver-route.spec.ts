import type { ComputerRacerRoute } from '../../../computer-racer-route/index.ts'
import { IDENTITY_MATRIX3 } from '../../../simulation-math/index.ts'
import { assignDriverRoute } from '../../types/racer-driver/racer-driver.ts'
import {
  createTestCarBodyWith,
  createTestContext,
} from '../../types/racer-fixtures/racer-fixtures.ts'
import {
  createRacer,
  createRacerSet,
  getRacer,
  setDriven,
} from '../../types/racer-state/racer-state.ts'
import type { Racer } from '../../types/racer.types.ts'
import { followDriverRoute } from './follow-driver-route.ts'

const ON_ROUTE_FLAG = 0x40
const REVERSING_FLAG = 0x20

// The loop point is (10, 0, 0); the next samples move 2 units on in x, 64 ms later.
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
    { first: 512, second: 0, bytes: [0, 0, 0, 0, 127, 24, 32, 0x42] },
  ],
  readByteCount: 0,
}

const createRouteRacer = (x: number, forwardSpeed = 1): Racer => {
  const frame = { rotation: IDENTITY_MATRIX3, position: { x, y: 0, z: 0 } }
  const racer = createRacer(
    createTestCarBodyWith({
      frame,
      displayFrame: frame,
      forwardSpeed,
      speed: Math.abs(forwardSpeed),
    })
  )
  return setDriven(
    racer,
    assignDriverRoute(
      createTestContext().arithmetic,
      { driver: racer.driver, carBody: racer.carBody },
      ROUTE
    )
  )
}

const withDriver = (racer: Racer, change: Partial<Racer['driver']>): Racer => ({
  ...racer,
  driver: { ...racer.driver, ...change },
})

const follow = (racer: Racer, step = 16): Racer =>
  getRacer(followDriverRoute(createTestContext(), createRacerSet([racer], 0, 0), 0, step), 0)

describe('assignDriverRoute, 0x004202f0', () => {
  it('puts the driver on the route with the target 1000 ms ahead of the loop point', () => {
    // Arrange
    const racer = createRouteRacer(0)

    // Act
    const { driver } = racer

    // Assert
    expect(driver.flags & ON_ROUTE_FLAG).toBe(ON_ROUTE_FLAG)
    expect(driver.routeStepMilliseconds).toBe(1000)
    expect(driver.route).toBe(ROUTE)
    expect(driver.targetPosition.x).toBeGreaterThan(10)
  })
})

describe('followDriverRoute, 0x004203b0', () => {
  it('hands the route to the car body within 3 units of the target', () => {
    // Arrange
    const racer = createRouteRacer(createRouteRacer(0).driver.targetPosition.x)

    // Act
    const result = follow(racer)

    // Assert
    expect(result.carBody.isScripted).toBe(true)
    expect(result.carBody.speedFactor).toBe(1)
    expect(result.carBody.routeFollower?.route).toBe(ROUTE)
    expect(result.driver.route).toBeNull()
    expect(result.driver.flags & ON_ROUTE_FLAG).toBe(0)
    expect(result.driver.routeStepMilliseconds).toBe(0)
    expect(result.driver.curvature).toBe(0)
    expect(result.carBody.rigidBody.displayFrame.position).toEqual({ x: 10, y: 0, z: 0 })
  })

  it('drives at 18 towards a target further than 3 units away', () => {
    // Arrange
    const racer = createRouteRacer(-100)

    // Act
    const result = follow(racer)

    // Assert
    expect(result.driver.throttle).toBe(18)
    expect(result.carBody.isScripted).toBe(false)
    expect(result.driver.route).toBe(ROUTE)
  })

  it('reverses with a throttle of -54 while the reversing flag is set', () => {
    // Arrange
    const racer = createRouteRacer(-100)
    const reversing = withDriver(racer, { flags: racer.driver.flags | REVERSING_FLAG })

    // Act
    const result = follow(reversing)

    // Assert
    expect(result.driver.throttle).toBe(-54)
  })

  it('moves the target 250 ms on when the car is within 30 units of it', () => {
    // Arrange
    const racer = createRouteRacer(createRouteRacer(0).driver.targetPosition.x - 20)

    // Act
    const result = follow(racer)

    // Assert
    expect(result.driver.routeStepMilliseconds).toBe(1250)
  })

  it('leaves the target when the car is further than 80 units from it', () => {
    // Arrange
    const racer = createRouteRacer(-200)

    // Act
    const result = follow(racer)

    // Assert
    expect(result.driver.routeStepMilliseconds).toBe(1000)
  })

  it('starts reversing after a second below a speed of 0.009', () => {
    // Arrange
    const racer = withDriver(createRouteRacer(-100, 0), { stuckMilliseconds: 990 })

    // Act
    const result = follow(racer, 16)

    // Assert
    expect(result.driver.flags & REVERSING_FLAG).toBe(REVERSING_FLAG)
    expect(result.driver.stuckMilliseconds).toBe(0)
  })
})
