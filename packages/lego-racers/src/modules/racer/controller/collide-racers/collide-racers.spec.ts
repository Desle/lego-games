import { IDENTITY_MATRIX3, ZERO_VECTOR3 } from '../../../simulation-math/index.ts'
import {
  createTestCarBodyWith,
  createTestContext,
} from '../../types/racer-fixtures/racer-fixtures.ts'
import { createFigure } from '../../types/figure/figure.ts'
import { createRacer, createRacerSet, getRacer } from '../../types/racer-state/racer-state.ts'
import type { Racer } from '../../types/racer.types.ts'
import { collideRacers, RACER_COLLISION_DEPENDENCIES_NOT_YET_PORTED } from './collide-racers.ts'

const CONTACT_FLAG = 0x10000000
const KICKED_FLAG = 0x100

// A 1 × 1 × 1 box with a bounding sphere of radius 1 at x on the track.
const createCarAt = (x: number, velocity = 0, change: Partial<Racer> = {}): Racer => {
  const position = { x, y: 0, z: 0 }
  const frame = { rotation: IDENTITY_MATRIX3, position }
  return {
    ...createRacer(
      createTestCarBodyWith({
        frame,
        displayFrame: frame,
        displayBoundingRadius: 1,
        worldCentreOfMass: position,
        linearVelocity: { x: velocity, y: 0, z: 0 },
        inverseMass: 0.5,
        groundedWheelCount: 4,
      }),
      createFigure([], { centre: ZERO_VECTOR3, radius: 1, radiusScale: 1 })
    ),
    controllerKind: 0,
    ...change,
  }
}

const collide = (racers: readonly Racer[], stepMilliseconds = 16) =>
  collideRacers(
    createTestContext(),
    createRacerSet(racers, 0, 0),
    stepMilliseconds,
    RACER_COLLISION_DEPENDENCIES_NOT_YET_PORTED
  )

describe('collideRacers, 0x0043d180', () => {
  it('starts with the nodes in reverse order, the last racer added being the head of list +0x2c', () => {
    // Arrange
    const racerSet = createRacerSet([createCarAt(0), createCarAt(1), createCarAt(2)], 0, 0)

    // Act
    const order = racerSet.collisionOrder

    // Assert
    expect(order).toEqual([2, 1, 0])
  })

  it('sorts the list by the lowest x of the bounding spheres, keeping equal keys in order', () => {
    // Arrange
    const racers = [createCarAt(5), createCarAt(0), createCarAt(10), createCarAt(5)]

    // Act
    const racerSet = collide(racers)

    // Assert
    expect(racerSet.collisionOrder).toEqual([1, 3, 0, 2])
  })

  it('leaves cars that are apart alone', () => {
    // Arrange
    const racers = [createCarAt(0, 1), createCarAt(10, -1)]

    // Act
    const racerSet = collide(racers)

    // Assert
    expect(getRacer(racerSet, 0).flags & CONTACT_FLAG).toBe(0)
    expect(getRacer(racerSet, 0).carBody.rigidBody.linearVelocity.x).toBe(1)
    expect(racerSet.randomPosition).toBe(0)
  })

  it('answers cars whose boxes overlap: the first in list order is the first car, and both bounce', () => {
    // Arrange
    const racers = [createCarAt(0, 1), createCarAt(0.5, -1)]

    // Act
    const racerSet = collide(racers)

    // Assert
    expect(racerSet.collisionOrder).toEqual([0, 1])
    expect(getRacer(racerSet, 0).flags & CONTACT_FLAG).toBe(CONTACT_FLAG)
    expect(getRacer(racerSet, 1).flags & CONTACT_FLAG).toBe(CONTACT_FLAG)
    expect(getRacer(racerSet, 0).carBody.rigidBody.linearVelocity.x).toBeLessThan(1)
    expect(getRacer(racerSet, 1).carBody.rigidBody.linearVelocity.x).toBeGreaterThan(-1)
  })

  it('tests spheres that overlap only; boxes that do not touch are not answered', () => {
    // Arrange
    const racers = [createCarAt(0), createCarAt(1.6)]

    // Act
    const racerSet = collide(racers)

    // Assert
    expect(getRacer(racerSet, 0).flags & CONTACT_FLAG).toBe(0)
  })
})

describe('collideRacers, the 750 ms timers', () => {
  it('counts a running timer up by the step', () => {
    // Arrange
    const racers = [createCarAt(0, 0, { contactTimerMilliseconds: 100, flags: KICKED_FLAG })]

    // Act
    const racerSet = collide(racers, 16)

    // Assert
    expect(getRacer(racerSet, 0).contactTimerMilliseconds).toBe(116)
  })

  it('ends the kick when the timer reaches 750 ms', () => {
    // Arrange
    const racers = [
      createCarAt(0, 0, { contactTimerMilliseconds: 740, flags: KICKED_FLAG, reactionKind: 1 }),
    ]

    // Act
    const racerSet = collide(racers, 16)

    // Assert
    expect(getRacer(racerSet, 0).contactTimerMilliseconds).toBeNull()
    expect(getRacer(racerSet, 0).flags & KICKED_FLAG).toBe(0)
    expect(getRacer(racerSet, 0).reactionKind).toBe(0)
  })
})

describe('collideRacers, the registry 0x0043d270', () => {
  const entry = {
    id: 7,
    flags: 0,
    maximumCalls: 1,
    interval: 0,
    calls: 0,
    ticks: 0,
    isActive: true,
    minimumExtent: -0.5,
    maximumExtent: 0.5,
  }

  it('gives a touched entry its contact and retires it after its last call', () => {
    // Arrange
    const racerSet = {
      ...createRacerSet([createCarAt(0), createCarAt(10)], 0, 0),
      registryEntries: [entry],
    }
    const dependencies = {
      ...RACER_COLLISION_DEPENDENCIES_NOT_YET_PORTED,
      getIsTouchingRegistryEntry: () => true,
    }

    // Act
    const result = collideRacers(createTestContext(), racerSet, 16, dependencies)

    // Assert
    expect(result.registryContacts).toEqual([{ id: 7, racer: 0, flags: 0, calls: 1, ticks: 1 }])
    expect(result.registryEntries).toEqual([])
  })

  it('finds no contact when the volume test says the racer is clear', () => {
    // Arrange
    const racerSet = {
      ...createRacerSet([createCarAt(0)], 0, 0),
      registryEntries: [entry],
    }

    // Act
    const result = collide(racerSet.racers, 16)
    const untouched = collideRacers(
      createTestContext(),
      racerSet,
      16,
      RACER_COLLISION_DEPENDENCIES_NOT_YET_PORTED
    )

    // Assert
    expect(result.registryContacts).toEqual([])
    expect(untouched.registryContacts).toEqual([])
    expect(untouched.registryEntries).toEqual([entry])
  })
})
