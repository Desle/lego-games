import type { CarRigidBody } from '../../../racer-physics/index.ts'
import { IDENTITY_MATRIX3 } from '../../../simulation-math/index.ts'
import {
  createTestCarBody,
  createTestCarBodyWith,
  IDENTITY_TABLES,
  SINGLE_ARITHMETIC,
} from '../racer-fixtures/racer-fixtures.ts'
import {
  foldCarBodySpinTimer,
  getCarBodyMaximumCurvature,
  getIsCarBodyAbleToPowerSlide,
  getIsCarBodyAbleToSlide,
  restoreCarBodySafePose,
  saveCarBodySafePose,
  setCarBodySteering,
  setCarBodyThrottle,
  startCarBodySlide,
  stopCarBodySlide,
} from './car-body.ts'

const PI = Math.fround(Math.PI)

const getWheels = (grounded: readonly (readonly [boolean, number])[]): CarRigidBody['wheels'] =>
  createTestCarBody().rigidBody.wheels.map((wheel, index) => ({
    ...wheel,
    isOnGround: grounded[index]?.[0] ?? false,
    grip: grounded[index]?.[1] ?? 0,
  }))

describe('setCarBodySteering', () => {
  it.each([
    [10, 40],
    [100, 100],
    [4096, 4096],
    [5000, 0],
    [0, 0],
    [-10, -40],
    [-4096, -4096],
    [-5000, 0],
  ])('stores %d as %d, as 0x00446ef0 clamps', (steering, expected) => {
    // Arrange
    const body = createTestCarBody()

    // Act
    const result = setCarBodySteering(SINGLE_ARITHMETIC, body, steering)

    // Assert
    expect(result.rigidBody.turnRadius).toBe(expected)
  })
})

describe('startCarBodySlide', () => {
  it.each([
    [PI, 512],
    [Math.fround(Math.SQRT1_2), 115],
  ])('looks the phase up at _ftol(rate · 162.97466) (rate %f → %d)', (rate, index) => {
    // Arrange
    const body = createTestCarBody()

    // Act
    const result = startCarBodySlide(SINGLE_ARITHMETIC, IDENTITY_TABLES, body, 1.5, 0.85, rate)

    // Assert
    expect(result.rigidBody).toMatchObject({
      driftYawFactor: 1.5,
      driftBrake: 0.85,
      driftMaximumAngle: rate,
      driftThreshold: index,
      flags: 0x1,
    })
  })
})

describe('stopCarBodySlide', () => {
  it('resets the phase to -1 and the rate to π and clears flags 0x201', () => {
    // Arrange
    const body = createTestCarBodyWith({ flags: 0x203, driftThreshold: 5, driftMaximumAngle: 2 })

    // Act
    const result = stopCarBodySlide(body)

    // Assert
    expect(result.rigidBody).toMatchObject({
      flags: 0x2,
      driftThreshold: -1,
      driftMaximumAngle: PI,
    })
  })
})

describe('getCarBodyMaximumCurvature', () => {
  it('is forwardSpeed² · mass / (gravity · scaledMass · average grip)', () => {
    // Arrange: grip (1 + 1) / 2 · 0.5 = 0.5, support 2 · 3 · 0.5 = 3, 3² · 2 / 3 = 6.
    const body = createTestCarBodyWith({
      forwardSpeed: 3,
      wheels: getWheels([
        [true, 1],
        [true, 1],
        [false, 9],
        [false, 9],
      ]),
    })

    // Act
    const curvature = getCarBodyMaximumCurvature(SINGLE_ARITHMETIC, body)

    // Assert
    expect(curvature).toBe(6)
  })

  it.each([
    [0, 100],
    [2, 4096],
  ])('without grip returns 100 airborne and 4096 grounded (%d wheels)', (count, expected) => {
    // Arrange
    const body = createTestCarBodyWith({ groundedWheelCount: count })

    // Act
    const curvature = getCarBodyMaximumCurvature(SINGLE_ARITHMETIC, body)

    // Assert
    expect(curvature).toBe(expected)
  })
})

describe('getIsCarBodyAbleToSlide', () => {
  const createAlignedBody = (speed: number, steering: number) =>
    createTestCarBodyWith({ velocityDirection: { x: 1, y: 0, z: 0 }, speed, turnRadius: steering })

  it.each([
    [0.1, 0, 1, true],
    [0.2, 0, 1, false],
    [0.1, 50, -1, false],
    [0.1, -50, 1, false],
  ])('speed %f, steering %d, curvature %d → %s', (speed, steering, curvature, isExpected) => {
    // Arrange
    const body = createAlignedBody(speed, steering)

    // Act
    const isAble = getIsCarBodyAbleToSlide(SINGLE_ARITHMETIC, body, curvature)

    // Assert
    expect(isAble).toBe(isExpected)
  })
})

describe('getIsCarBodyAbleToPowerSlide', () => {
  it('needs three grounded wheels, alignment over 0.85 and forward speed of 0.05', () => {
    // Arrange
    const body = createTestCarBodyWith({
      velocityDirection: { x: 1, y: 0, z: 0 },
      groundedWheelCount: 3,
      forwardSpeed: Math.fround(0.05),
    })

    // Act
    const results = [
      getIsCarBodyAbleToPowerSlide(SINGLE_ARITHMETIC, body),
      getIsCarBodyAbleToPowerSlide(SINGLE_ARITHMETIC, {
        ...body,
        rigidBody: { ...body.rigidBody, groundedWheelCount: 2 },
      }),
      getIsCarBodyAbleToPowerSlide(SINGLE_ARITHMETIC, {
        ...body,
        rigidBody: { ...body.rigidBody, forwardSpeed: 0.04 },
      }),
    ]

    // Assert
    expect(results).toEqual([true, false, false])
  })
})

describe('setCarBodyThrottle', () => {
  it.each([
    [3, 6, 3],
    [-3, -6, 3],
    [0, 0, 0],
  ])(
    'throttle %d → +0x628 %d and drive factor %d (|t| · mass / radius²)',
    (throttle, stored, drive) => {
      // Arrange
      const body = { ...createTestCarBody(), throttleScale: 2 }

      // Act
      const result = setCarBodyThrottle(SINGLE_ARITHMETIC, body, throttle)

      // Assert
      expect(result.rigidBody.throttle).toBe(stored)
      expect(result.rigidBody.drag).toBe(drive)
    }
  )
})

describe('foldCarBodySpinTimer', () => {
  it.each([
    [25, 10, 5],
    [20, 10, 10],
    [7, 10, 7],
  ])('folds %d by periods of %d into %d', (pending, period, expected) => {
    // Arrange
    const body = createTestCarBodyWith({ spinTimer: pending, spinPeriod: period })

    // Act
    const result = foldCarBodySpinTimer(body)

    // Assert
    expect(result.rigidBody).toMatchObject({ yawTimer: expected, spinTimer: 0, spinPeriod: 0 })
  })
})

describe('saveCarBodySafePose and restoreCarBodySafePose', () => {
  it('returns the body to the saved pose at rest', () => {
    // Arrange
    const saved = saveCarBodySafePose(SINGLE_ARITHMETIC, createTestCarBody())
    const moved = {
      ...saved,
      rigidBody: {
        ...saved.rigidBody,
        frame: { rotation: IDENTITY_MATRIX3, position: { x: 5, y: 6, z: 400 } },
        linearVelocity: { x: 1, y: 1, z: 1 },
        angularMomentum: { x: 2, y: 2, z: 2 },
      },
    }

    // Act
    const restored = restoreCarBodySafePose(SINGLE_ARITHMETIC, moved)

    // Assert
    expect(saved.safeOrientation).toEqual({ x: 0, y: 0, z: 0, w: 1 })
    expect(restored.rigidBody.frame).toEqual({
      rotation: IDENTITY_MATRIX3,
      position: { x: 0, y: 0, z: 0 },
    })
    expect(restored.rigidBody.linearVelocity).toEqual({ x: 0, y: 0, z: 0 })
    expect(restored.rigidBody.angularMomentum).toEqual({ x: 0, y: 0, z: 0 })
  })
})
