import {
  createFloatArithmetic,
  getRotationFromFirstAndSecondAxes,
  IDENTITY_MATRIX3,
  RACE_FPU_PRECISION,
} from '../../../simulation-math/index.ts'
import type { Matrix3 } from '../../../simulation-math/index.ts'
import { getVehicleLean } from './vehicle-lean.ts'
import type { VehicleLeanRequest } from './vehicle-lean.types.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
const SEAT_POINT = Object.freeze({ x: 0.5, y: 0, z: 3 })

const getRequest = (overrides: Partial<VehicleLeanRequest>): VehicleLeanRequest => ({
  arithmetic,
  displayFrame: { rotation: IDENTITY_MATRIX3, position: { x: 10, y: 20, z: 30 } },
  bodyRotation: IDENTITY_MATRIX3,
  forwardLean: 0,
  sideLean: 0,
  stepMilliseconds: 16,
  mass: 2500,
  seatPoint: SEAT_POINT,
  ...overrides,
})

// A display frame whose up axis tilts towards the side axis by `angle` radians.
const getRolledRotation = (angle: number): Matrix3 =>
  getRotationFromFirstAndSecondAxes(
    arithmetic,
    { x: 1, y: 0, z: 0 },
    { x: 0, y: Math.cos(angle), z: -Math.sin(angle) }
  )

describe('getVehicleLean', () => {
  it('keeps a level car model level and seats the driver above the display frame', () => {
    // Arrange
    const request = getRequest({})

    // Act
    const lean = getVehicleLean(request)

    // Assert
    expect(lean.bodyRotation).toEqual(IDENTITY_MATRIX3)
    expect(lean.forwardLean).toBe(0)
    expect(lean.sideLean).toBe(0)
    expect(lean.driverPosition).toEqual({ x: 10.5, y: 20, z: 33 })
  })

  it('leans the car model towards a rolled display frame without reaching it at once', () => {
    // Arrange
    const rolled = getRolledRotation(0.3)
    const request = getRequest({
      displayFrame: { rotation: rolled, position: { x: 0, y: 0, z: 0 } },
    })

    // Act
    const lean = getVehicleLean(request)

    // Assert
    expect(lean.sideLean).not.toBe(0)
    expect(lean.bodyRotation[7]).not.toBe(0)
    expect(Math.abs(lean.bodyRotation[7])).toBeLessThan(Math.abs(rolled[7]))
  })

  it('settles back on a display frame it already matches', () => {
    // Arrange
    const rolled = getRolledRotation(0.3)
    const request = getRequest({
      displayFrame: { rotation: rolled, position: { x: 0, y: 0, z: 0 } },
      bodyRotation: rolled,
    })

    // Act
    const lean = getVehicleLean(request)

    // Assert
    expect(Math.abs(lean.sideLean)).toBeLessThan(1e-6)
    expect(Math.abs(lean.bodyRotation[7] - rolled[7])).toBeLessThan(1e-5)
  })
})
