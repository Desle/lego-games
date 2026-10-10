import { IDENTITY_MATRIX3, ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import {
  FIXTURE_ARITHMETIC,
  FIXTURE_CAR,
} from '../../types/racer-setup-fixtures/racer-setup-fixtures.ts'
import { CAR_RIGID_BODY_RACE_MODE_FLAG, createCarBodySetup } from './create-car-body.ts'

const OPTIONS = {
  displayFrame: { rotation: IDENTITY_MATRIX3, position: ZERO_VECTOR3 },
  displayBoundingRadius: 5,
  isRaceModeFlagged: false,
}

describe('createCarBodySetup', () => {
  it('attaches a box of 8 by 5 by 6.2 with the car mass and centre of mass (0x004371c0)', () => {
    // Arrange
    const car = FIXTURE_CAR

    // Act
    const { rigidBody } = createCarBodySetup(FIXTURE_ARITHMETIC, car, OPTIONS)

    // Assert
    expect(rigidBody.scaledMass).toBeCloseTo(4500 * 0.001 * 0.001, 9)
    expect(rigidBody.localCentreOfMass).toEqual({ x: -1, y: 0, z: -1 })
    expect(rigidBody.displayBoundingRadius).toBe(5)
  })

  it('anchors the wheels at the second wheel point with the track and wheelbase of the other two', () => {
    // Arrange
    const car = FIXTURE_CAR

    // Act
    const { rigidBody } = createCarBodySetup(FIXTURE_ARITHMETIC, car, OPTIONS)

    // Assert
    expect(rigidBody.localWheelAnchor).toEqual({ x: 1.5, y: 2, z: 0 })
    expect(rigidBody.trackWidth).toBe(4)
    expect(rigidBody.wheelbase).toBe(3)
  })

  it('puts the four hull points at half the extents and 3.5 high', () => {
    // Arrange
    const car = FIXTURE_CAR

    // Act
    const { rigidBody } = createCarBodySetup(FIXTURE_ARITHMETIC, car, OPTIONS)

    // Assert
    expect(rigidBody.localHullPoints).toEqual([
      { x: 4.5, y: -4, z: 3.5 },
      { x: 4.5, y: 4, z: 3.5 },
      { x: -4.5, y: -4, z: 3.5 },
      { x: -4.5, y: 4, z: 3.5 },
    ])
  })

  it('turns the three ratings into the steering, throttle and top speed scales', () => {
    // Arrange
    const car = FIXTURE_CAR

    // Act
    const setup = createCarBodySetup(FIXTURE_ARITHMETIC, car, OPTIONS)

    // Assert
    expect(setup.steeringScale).toBeCloseTo(0.7 + 60 * 0.003, 6)
    expect(setup.throttleScale).toBeCloseTo(1 - (50 - 80) * 0.001, 6)
    expect(setup.topSpeedScale).toBeCloseTo(1, 6)
  })

  it('sets the top speed to 120 times the top speed scale (0x00429330, slot 6)', () => {
    // Arrange
    const car = { ...FIXTURE_CAR, topSpeedRating: 70 }

    // Act
    const setup = createCarBodySetup(FIXTURE_ARITHMETIC, car, OPTIONS)

    // Assert
    expect(setup.rigidBody.topSpeed).toBeCloseTo(120 * 1.02, 4)
  })

  it('lets a built car weight shift the ratings by one point per 20 units', () => {
    // Arrange
    const car = { ...FIXTURE_CAR, weight: 119 }

    // Act
    const setup = createCarBodySetup(FIXTURE_ARITHMETIC, car, OPTIONS)

    // Assert
    expect(setup.steeringScale).toBeCloseTo(0.7 + 65 * 0.003, 6)
    expect(setup.throttleScale).toBeCloseTo(1 - (50 - 75) * 0.001, 6)
    expect(setup.topSpeedScale).toBeCloseTo(1 - (50 - 55) * 0.001, 6)
  })

  it('caps the raised ratings at 100 and floors the lowered one at 0', () => {
    // Arrange
    const car = { ...FIXTURE_CAR, weight: 4000, steeringRating: 90, throttleRating: 10 }

    // Act
    const setup = createCarBodySetup(FIXTURE_ARITHMETIC, car, OPTIONS)

    // Assert
    expect(setup.steeringScale).toBeCloseTo(0.7 + 100 * 0.003, 6)
    expect(setup.throttleScale).toBeCloseTo(1 - 50 * 0.001, 6)
    expect(setup.topSpeedScale).toBeCloseTo(1 + 50 * 0.001, 6)
  })

  it('sets car rigid body flag 0x100000 only for a flagged race mode', () => {
    // Arrange
    const flagged = { ...OPTIONS, isRaceModeFlagged: true }

    // Act
    const plain = createCarBodySetup(FIXTURE_ARITHMETIC, FIXTURE_CAR, OPTIONS)
    const raised = createCarBodySetup(FIXTURE_ARITHMETIC, FIXTURE_CAR, flagged)

    // Assert
    expect(plain.rigidBody.flags & CAR_RIGID_BODY_RACE_MODE_FLAG).toBe(0)
    expect(raised.rigidBody.flags & CAR_RIGID_BODY_RACE_MODE_FLAG).toBe(
      CAR_RIGID_BODY_RACE_MODE_FLAG
    )
  })

  it('refuses a car without four wheel points', () => {
    // Arrange
    const car = { ...FIXTURE_CAR, wheelPoints: FIXTURE_CAR.wheelPoints.slice(0, 2) }

    // Act
    const create = () => createCarBodySetup(FIXTURE_ARITHMETIC, car, OPTIONS)

    // Assert
    expect(create).toThrow(RangeError)
  })
})
