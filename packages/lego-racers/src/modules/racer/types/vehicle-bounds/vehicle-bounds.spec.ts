import { ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import { createFigure } from '../figure/figure.ts'
import {
  createTestCarBodyWith,
  IDENTITY_TABLES,
  SINGLE_ARITHMETIC,
} from '../racer-fixtures/racer-fixtures.ts'
import { createRacer } from '../racer-state/racer-state.ts'
import {
  getFreshRacerVolumeParts,
  getRacerReadVolumeParts,
  getRacerVolumeParts,
} from '../racer-volume/racer-volume.ts'
import type { Racer } from '../racer.types.ts'
import { createVehicle } from '../vehicle/vehicle.ts'
import {
  getRacerAfterWarpDraw,
  getRacerWithPartsMarked,
  getWarpFadeScale,
} from './vehicle-bounds.ts'

const FIGURE_CHILD = { centre: { x: 0, y: 0, z: 1 }, radius: 2, radiusScale: 1 }

const createWarpingCar = (): Racer => {
  const wheels = createFigure([], FIGURE_CHILD)
  const driver = createFigure([], FIGURE_CHILD)
  const racer = createRacer(
    createTestCarBodyWith({
      displayFrame: {
        rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1],
        position: { x: 10, y: 20, z: 30 },
      },
    }),
    wheels
  )
  return {
    ...racer,
    vehicle: createVehicle(driver, { x: 0, y: 1, z: 2 }, 0, {
      centre: { x: 0, y: 0, z: 1 },
      radius: 3,
    }),
  }
}

describe('getRacerWithPartsMarked', () => {
  it('leaves every part at a negative radius with its centre where it was, and scales the parts', () => {
    // Arrange
    const racer = createWarpingCar()
    const freshBefore = getFreshRacerVolumeParts(SINGLE_ARITHMETIC, racer)

    // Act
    const marked = getRacerWithPartsMarked(SINGLE_ARITHMETIC, racer, 0.5)
    const raw = getRacerVolumeParts(SINGLE_ARITHMETIC, marked)

    // Assert
    expect(raw.wheels).toEqual({ centre: freshBefore.wheels.centre, radius: -1 })
    expect(raw.driver.radius).toBe(-1)
    expect(raw.body?.radius).toBe(-1)
    expect(marked.figure.scale).toBe(0.5)
    expect(marked.vehicle.bodyScale).toBe(0.5)
  })

  it('reads a marked part as a refreshed one with the new scale', () => {
    // Arrange
    const racer = createWarpingCar()

    // Act
    const read = getRacerReadVolumeParts(
      SINGLE_ARITHMETIC,
      getRacerWithPartsMarked(SINGLE_ARITHMETIC, racer, 0.5)
    )

    // Assert
    expect(read.wheels.radius).toBe(1)
    expect(read.body?.radius).toBe(1.5)
  })

  it('moves the radius the ground probe reads to the scaled figure', () => {
    // Arrange
    const racer = createWarpingCar()

    // Act
    const marked = getRacerWithPartsMarked(SINGLE_ARITHMETIC, racer, 0.5)

    // Assert
    expect(marked.carBody.rigidBody.displayBoundingRadius).toBe(1)
  })
})

describe('getRacerAfterWarpDraw', () => {
  it('puts the car model, the driver and the display figure sphere at the origin, facing -y', () => {
    // Arrange
    const racer = createWarpingCar()

    // Act
    const drawn = getRacerAfterWarpDraw(SINGLE_ARITHMETIC, racer)
    const raw = getRacerVolumeParts(SINGLE_ARITHMETIC, drawn)

    // Assert
    expect(drawn.vehicle.bodyRotation.slice(0, 3)).toEqual([0, -1, 0])
    expect(raw.wheels.centre).toEqual({ x: 0, y: 0, z: 1 })
    expect(raw.wheels.radius).toBe(-1)
    expect(raw.body?.centre).toEqual({ x: 0, y: 0, z: 1 })
    expect(raw.body?.radius).toBe(3)
    expect(drawn.vehicle.driverPosition.z).toBe(2)
  })

  it('leaves the display frame where it was', () => {
    // Arrange
    const racer = createWarpingCar()

    // Act
    const drawn = getRacerAfterWarpDraw(SINGLE_ARITHMETIC, racer)

    // Assert
    expect(drawn.carBody.rigidBody.displayFrame).toEqual(racer.carBody.rigidBody.displayFrame)
    expect(ZERO_VECTOR3).toEqual({ x: 0, y: 0, z: 0 })
  })
})

describe('getWarpFadeScale', () => {
  it('follows the table with the index the time gives', () => {
    // Arrange: the test table holds n at index n, and 100 ms is the index (102 - 0x100) & 0x3ff = 870
    const tables = IDENTITY_TABLES

    // Act
    const scale = getWarpFadeScale(SINGLE_ARITHMETIC, tables, 100)

    // Assert
    expect(scale).toBe(870)
  })
})
