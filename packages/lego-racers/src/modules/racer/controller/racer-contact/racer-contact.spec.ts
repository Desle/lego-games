import { CarRigidBodyFlag } from '../../../racer-physics/index.ts'
import { IDENTITY_MATRIX3 } from '../../../simulation-math/index.ts'
import type { Matrix3 } from '../../../simulation-math/index.ts'
import {
  createTestCarBodyWith,
  createTestContext,
} from '../../types/racer-fixtures/racer-fixtures.ts'
import { createRacer, createRacerSet, getRacer } from '../../types/racer-state/racer-state.ts'
import type { Racer, RacerCollisionDependencies, RacerSet } from '../../types/racer.types.ts'
import { endRacerKick, respondToBodyContact, respondToRacerContact } from './racer-contact.ts'

const CONTACT_FLAG = 0x10000000
const ATTACKING_FLAG = 0x1
const TIMED_EFFECT_FLAG = 0x800
const COMPUTER = 2
const CONTACT = Object.freeze({
  depth: 0.1,
  normal: { x: -1, y: 0, z: 0 },
  point: { x: 1, y: 0, z: 0 },
})

const createCar = (
  x: number,
  velocity: number,
  speed: number,
  change: Partial<Racer> = {},
  rotation: Matrix3 = IDENTITY_MATRIX3
): Racer => ({
  ...createRacer(
    createTestCarBodyWith({
      worldCentreOfMass: { x, y: 0, z: 0 },
      linearVelocity: { x: velocity, y: 0, z: 0 },
      displayFrame: {
        rotation,
        position: { x, y: 0, z: 0 },
      },
      inverseMass: 0.5,
      speed,
      groundedWheelCount: 4,
      scaledMass: 3,
    })
  ),
  controllerKind: 0,
  ...change,
})

const createDependencies = (calls: string[]): RacerCollisionDependencies => ({
  separateScriptedCarBody: (_context, racerSet, racerIndex) => {
    calls.push(`separate:${String(racerIndex)}`)
    return racerSet
  },
  transferTimedEffect: (_context, racerSet, receiver, giver) => {
    calls.push(`transfer:${String(giver)}>${String(receiver)}`)
    return racerSet
  },
  endTimedEffect: (_context, racerSet, racerIndex) => {
    calls.push(`end:${String(racerIndex)}`)
    return racerSet
  },
})

const respond = (first: Racer, second: Racer, calls: string[] = []): RacerSet =>
  respondToRacerContact(
    createTestContext(),
    createRacerSet([first, second], 0, 0),
    0,
    1,
    CONTACT,
    createDependencies(calls)
  )

describe('respondToRacerContact, 0x00438560 type 3', () => {
  it('moves the first car out by depth × normal and bounces both with restitution 0.75', () => {
    // Arrange
    const first = createCar(0, 1, 0.5)
    const second = createCar(2, -1, 0.5)

    // Act
    const racerSet = respond(first, second)

    // Assert
    const [a, b] = [getRacer(racerSet, 0), getRacer(racerSet, 1)]
    expect(a.carBody.rigidBody.displayFrame.position.x).toBe(-0.10000000149011612)
    expect(b.carBody.rigidBody.displayFrame.position.x).toBe(2)
    expect(a.carBody.rigidBody.linearVelocity.x).toBe(-0.75)
    expect(b.carBody.rigidBody.linearVelocity.x).toBe(0.75)
    expect((a.flags & CONTACT_FLAG) !== 0 && (b.flags & CONTACT_FLAG) !== 0).toBe(true)
  })

  it('gives the slower car a voice line and starts the 250 ms collision sound wait, with three draws', () => {
    // Arrange
    const first = createCar(0, 1, 1)
    const second = createCar(2, -1, 0.5)

    // Act
    const racerSet = respond(first, second)

    // Assert
    expect(getRacer(racerSet, 0).collisionSoundMilliseconds).toBe(250)
    expect(getRacer(racerSet, 1).collisionSoundMilliseconds).toBe(250)
    expect(getRacer(racerSet, 1).voiceMilliseconds).toBe(3 * 4 + 5000)
    expect(getRacer(racerSet, 0).voiceMilliseconds).toBe(0)
    expect(racerSet.randomPosition).toBe(3)
  })

  it('lets two computers fade for 750 ms instead of speaking', () => {
    // Arrange
    const first = createCar(0, 1, 0.5, { controllerKind: COMPUTER })
    const second = createCar(2, -1, 0.5, { controllerKind: COMPUTER })

    // Act
    const racerSet = respond(first, second)

    // Assert
    expect(getRacer(racerSet, 0).fadeMilliseconds).toBe(750)
    expect(getRacer(racerSet, 1).fadeMilliseconds).toBe(750)
    expect(racerSet.randomPosition).toBe(0)
  })

  it('does nothing for a disabled racer or a car body whose flag 0x80 is set', () => {
    // Arrange
    const first = createCar(0, 1, 0.5, { flags: 0x10 })
    const flagged = createCar(0, 1, 0.5)
    const second = createCar(2, -1, 0.5)
    const carWithEffect = {
      ...flagged,
      carBody: createTestCarBodyWith({ flags: CarRigidBodyFlag.FLAGGED }),
    }

    // Act
    const disabled = respond(first, second)
    const held = respond(carWithEffect, second)

    // Assert
    expect(getRacer(disabled, 0).flags).toBe(0x10)
    expect(getRacer(held, 1).carBody.rigidBody.linearVelocity.x).toBe(-1)
  })

  it('spins a racer without flag 0x1 that is hit by one with attack kind 2', () => {
    // Arrange
    const first = createCar(0, 1, 0.5, { flags: ATTACKING_FLAG, attackKind: 2 })
    const second = createCar(2, -1, 0.5)

    // Act
    const racerSet = respond(first, second)

    // Assert
    expect(getRacer(racerSet, 1).carBody.rigidBody.yawTimer).toBeGreaterThan(0)
    expect(getRacer(racerSet, 0).carBody.rigidBody.yawTimer).toBe(0)
  })

  it('kicks a racer hit from the side by attack kind 1: a slide, a force and a 750 ms timer', () => {
    // Arrange
    const first = createCar(0, 1, 0.5, { flags: ATTACKING_FLAG, attackKind: 1 })
    const second = createCar(2, -1, 0.5, {}, [0, 1, 0, -1, 0, 0, 0, 0, 1])

    // Act
    const racerSet = respond(first, second)
    const kicked = getRacer(racerSet, 1)

    // Assert
    expect(kicked.flags & 0x100).toBe(0x100)
    expect(kicked.reactionKind).toBe(1)
    expect(kicked.contactTimerMilliseconds).toBe(0)
    expect(kicked.carBody.rigidBody.flags & CarRigidBodyFlag.EXTRA_FORCE_A).not.toBe(0)
    expect(kicked.carBody.rigidBody.flags & CarRigidBodyFlag.DRIFTING).not.toBe(0)
  })

  it('passes a timed effect on to a racer that has none, and ends it on the giver', () => {
    // Arrange
    const calls: string[] = []
    const first = createCar(0, 1, 0.5, {
      flags: TIMED_EFFECT_FLAG,
      timedEffectCharge: 1000,
      timedEffectMilliseconds: 3000,
    })
    const second = createCar(2, -1, 0.5)

    // Act
    respond(first, second, calls)

    // Assert
    expect(calls).toEqual(['transfer:0>1', 'end:0'])
  })

  it('hands a scripted first car to the route follower instead of moving its frame', () => {
    // Arrange
    const calls: string[] = []
    const first = createCar(0, 1, 0.5)
    const scripted = { ...first, carBody: { ...first.carBody, isScripted: true } }
    const second = createCar(2, -1, 0.5)

    // Act
    respond(scripted, second, calls)

    // Assert
    expect(calls).toEqual(['separate:0'])
  })
})

describe('endRacerKick, the 750 ms timer event', () => {
  it('releases the force that was added, clears flag 0x100 and forgets the timer', () => {
    // Arrange
    const first = createCar(0, 1, 0.5, { flags: ATTACKING_FLAG, attackKind: 1 })
    const racerSet = respond(first, createCar(2, -1, 0.5, {}, [0, 1, 0, -1, 0, 0, 0, 0, 1]))

    // Act
    const ended = getRacer(endRacerKick(createTestContext(), racerSet, 1), 1)

    // Assert
    expect(ended.flags & 0x100).toBe(0)
    expect(ended.reactionKind).toBe(0)
    expect(ended.contactTimerMilliseconds).toBeNull()
    expect(ended.carBody.rigidBody.flags & CarRigidBodyFlag.EXTRA_FORCE_A).toBe(0)
  })
})

describe('respondToBodyContact, 0x00438560 type 3 without a second racer', () => {
  const body = Object.freeze({
    sphere: { centre: { x: 2, y: 0, z: 0 }, radius: 1 },
    box: {
      rotation: IDENTITY_MATRIX3,
      centre: { x: 2, y: 0, z: 0 },
      dimensions: { x: 1, y: 1, z: 1 },
      scale: 1,
    },
    linearVelocity: { x: 0, y: 0, z: 0 },
    inverseMass: 0.00005,
  })

  it('moves the racer out and bounces it off the body alone, without a contact flag, a voice or a random draw', () => {
    // Arrange
    const racerSet = createRacerSet([createCar(0, 1, 1)], 0, 0)

    // Act
    const result = respondToBodyContact(
      createTestContext(),
      racerSet,
      0,
      body,
      CONTACT,
      createDependencies([])
    )

    // Assert
    const racer = getRacer(result, 0)
    expect(racer.carBody.rigidBody.displayFrame.position.x).toBe(-0.10000000149011612)
    expect(racer.carBody.rigidBody.linearVelocity.x).toBeLessThan(0)
    expect(racer.flags & CONTACT_FLAG).toBe(0)
    expect(racer.voiceMilliseconds).toBe(0)
    expect(result.randomPosition).toBe(0)
  })

  it('does nothing for a disabled racer', () => {
    // Arrange
    const racerSet = createRacerSet([createCar(0, 1, 1, { flags: 0x10 })], 0, 0)

    // Act
    const result = respondToBodyContact(
      createTestContext(),
      racerSet,
      0,
      body,
      CONTACT,
      createDependencies([])
    )

    // Assert
    expect(result).toBe(racerSet)
  })
})
