import { createTestCarBodyWith, SINGLE_ARITHMETIC } from '../racer-fixtures/racer-fixtures.ts'
import { createRacer } from '../racer-state/racer-state.ts'
import type { Racer } from '../racer.types.ts'
import {
  getBoostSmokePosition,
  getDustPosition,
  getEmitterVelocityOffset,
  getRearRightWheelAnchor,
  getTireSmokePosition,
} from './vehicle-emitter-placement.ts'

const createRacerWithWheels = (markingFlags: readonly number[]): Racer => {
  const base = createRacer(createTestCarBodyWith({}))
  const wheels = base.carBody.rigidBody.wheels.map((wheel, index) => ({
    ...wheel,
    anchor: { x: index, y: index * 10, z: 1 },
  }))
  return {
    ...base,
    carBody: {
      ...base.carBody,
      rigidBody: {
        ...base.carBody.rigidBody,
        wheels,
        linearVelocity: { x: 1, y: 2, z: 3 },
      },
    },
    vehicle: {
      ...base.vehicle,
      skids: { ...base.vehicle.skids, flags: markingFlags },
    },
  }
}

describe('where the vehicle puts its emitters', () => {
  it('starts the dust and the tire smoke at the rear right wheel', () => {
    // Arrange
    const racer = createRacerWithWheels([0, 0, 0, 0])

    // Act
    const anchor = getRearRightWheelAnchor(racer)

    // Assert
    expect(anchor).toEqual({ x: 3, y: 30, z: 1 })
  })

  it('moves the dust to the rear right wheel when the draw has its second bit, else the rear left', () => {
    // Arrange
    const racer = createRacerWithWheels([0, 0, 0, 0])

    // Act
    const right = getDustPosition(racer, true)
    const left = getDustPosition(racer, false)

    // Assert
    expect(right.x).toBe(3)
    expect(left.x).toBe(2)
  })

  it('puts the boost smoke between the rear wheels, 2 higher', () => {
    // Arrange
    const racer = createRacerWithWheels([0, 0, 0, 0])

    // Act
    const position = getBoostSmokePosition(SINGLE_ARITHMETIC, racer)

    // Assert
    expect(position).toEqual({ x: 2.5, y: 25, z: 3 })
  })

  it('puts the tire smoke at the first marking wheel, or the last after the first', () => {
    // Arrange
    const racer = createRacerWithWheels([0, 1, 1, 1])

    // Act
    const first = getTireSmokePosition(racer, true)
    const last = getTireSmokePosition(racer, false)

    // Assert
    expect(first.x).toBe(1)
    expect(last.x).toBe(3)
  })

  it('puts the tire smoke at the origin when no wheel or only one marks and the draw asks for the later one', () => {
    // Arrange
    const none = createRacerWithWheels([0, 0, 0, 0])
    const single = createRacerWithWheels([0, 1, 0, 0])

    // Act
    const positions = [getTireSmokePosition(none, true), getTireSmokePosition(single, false)]

    // Assert
    expect(positions).toEqual([
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    ])
  })

  it('gives the emitters 0.6 of the car velocity', () => {
    // Arrange
    const racer = createRacerWithWheels([0, 0, 0, 0])

    // Act
    const offset = getEmitterVelocityOffset(SINGLE_ARITHMETIC, racer)

    // Assert
    expect(offset.y).toBeCloseTo(1.2)
  })
})
