import { createCarRigidBody } from '../../../racer-physics/index.ts'
import { IDENTITY_MATRIX3, ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import { FIXTURE_ARITHMETIC } from '../racer-setup-fixtures/racer-setup-fixtures.ts'
import {
  BASE_TOP_SPEED,
  getRatingScale,
  getSteeringScale,
  setTopSpeedRating,
} from './car-scales.ts'

const getBody = () =>
  createCarRigidBody(FIXTURE_ARITHMETIC, {
    displayFrame: { rotation: IDENTITY_MATRIX3, position: ZERO_VECTOR3 },
    displayBoundingRadius: 1,
    mass: 100,
    dimensions: { x: 8, y: 5, z: 6 },
  })

describe('getSteeringScale', () => {
  it('is 0.7 + 0.003 per rating point', () => {
    // Arrange
    const ratings = [0, 50, 100]

    // Act
    const scales = ratings.map((rating) => getSteeringScale(FIXTURE_ARITHMETIC, rating))

    // Assert
    expect(scales[0]).toBeCloseTo(0.7, 6)
    expect(scales[1]).toBeCloseTo(0.85, 6)
    expect(scales[2]).toBeCloseTo(1, 6)
  })
})

describe('getRatingScale', () => {
  it('is 1 at rating 50 and moves by 0.001 per point', () => {
    // Arrange
    const ratings = [0, 50, 100]

    // Act
    const scales = ratings.map((rating) => getRatingScale(FIXTURE_ARITHMETIC, rating))

    // Assert
    expect(scales[0]).toBeCloseTo(0.95, 6)
    expect(scales[1]).toBe(1)
    expect(scales[2]).toBeCloseTo(1.05, 6)
  })
})

describe('setTopSpeedRating', () => {
  it('sets the top speed to the scale times 120 and returns the scale', () => {
    // Arrange
    const body = getBody()

    // Act
    const result = setTopSpeedRating(FIXTURE_ARITHMETIC, body, 100)

    // Assert
    expect(BASE_TOP_SPEED).toBe(120)
    expect(result.scale).toBeCloseTo(1.05, 6)
    expect(result.rigidBody.topSpeed).toBeCloseTo(126, 4)
  })

  it('also puts the grip scale back to 1 and clears flag 0x10000 (0x00429330)', () => {
    // Arrange
    const body = { ...getBody(), gripScale: 0.5, flags: 0x10000 | 0x4 }

    // Act
    const result = setTopSpeedRating(FIXTURE_ARITHMETIC, body, 50)

    // Assert
    expect(result.rigidBody.gripScale).toBe(1)
    expect(result.rigidBody.flags).toBe(0x4)
  })
})
