import { createCarBody } from '../../../racer/index.ts'
import { createFixtureRacerDefinition, FIXTURE_ARITHMETIC } from '../race-fixtures/race-fixtures.ts'
import { placeCarBodyOnRoute, stepScriptedCarBody } from './scripted-car-body.ts'

const ROUTE = {
  firstVector: [4, 5, 6],
  firstQuaternion: [0, 0, 0, 1],
  secondVector: [4, 5, 6],
  secondQuaternion: [0, 0, 0, 1],
  firstInteger: 0,
  sampleIndex: 0,
  // First sample: 1.0 forward in x (256 · 2^-8), no rotation change, 64 ms (byte 11 = 2 → 2 << 5).
  samples: [
    { first: 256, second: 0, bytes: [0, 0, 0, 0, 127, 0, 0, 0x02] },
    { first: 256, second: 0, bytes: [0, 0, 0, 0, 127, 0, 0, 0x02] },
  ],
  readByteCount: 0,
} as const

const getCarBody = () => createCarBody(createFixtureRacerDefinition(2).carBody)

describe('scripted car body', () => {
  it('is placed on the first position of its route and held (0x0042a670)', () => {
    // Arrange
    const carBody = getCarBody()

    // Act
    const placed = placeCarBodyOnRoute(FIXTURE_ARITHMETIC, carBody, ROUTE)

    // Assert
    expect(placed.isScripted).toBe(true)
    expect(placed.isRouteHeld).toBe(true)
    expect(placed.rigidBody.displayFrame.position).toEqual({ x: 4, y: 5, z: 6 })
  })

  it('stays where it is while held', () => {
    // Arrange
    const placed = placeCarBodyOnRoute(FIXTURE_ARITHMETIC, getCarBody(), ROUTE)

    // Act
    const stepped = stepScriptedCarBody(FIXTURE_ARITHMETIC, placed, 33)

    // Assert
    expect(stepped).toBe(placed)
  })

  it('follows the route once released: the follower advances and the velocity is the distance over the step', () => {
    // Arrange
    const placed = placeCarBodyOnRoute(FIXTURE_ARITHMETIC, getCarBody(), ROUTE)
    const released = Object.freeze({ ...placed, isRouteHeld: false })

    // Act
    const stepped = stepScriptedCarBody(FIXTURE_ARITHMETIC, released, 32)

    // Assert
    expect(stepped.routeFollower?.time).toBe(32)
    expect(stepped.rigidBody.displayFrame.position.x).toBeCloseTo(4.5, 5)
    expect(stepped.rigidBody.linearVelocity.x).toBeCloseTo(0.5 / 32, 6)
    expect(stepped.rigidBody.frame.position).toEqual(stepped.rigidBody.displayFrame.position)
  })
})
