import {
  createFloatArithmetic,
  FpuPrecision,
  IDENTITY_MATRIX3,
} from '../../../simulation-math/index.ts'
import { CarRigidBodyFlag, createCarRigidBody } from '../car-rigid-body/car-rigid-body.ts'
import { advanceToContact, respondToContact } from './hull-contacts.ts'
import { CAR_RIGID_BODY_HOOKS } from '../rigid-body-step/rigid-body-step.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)

const CAR = createCarRigidBody(SINGLE, {
  displayFrame: { rotation: IDENTITY_MATRIX3, position: { x: 0, y: 0, z: 0 } },
  displayBoundingRadius: 5,
  mass: 1,
  dimensions: { x: 8, y: 5, z: 6.2 },
})

describe('respondToContact', () => {
  it('removes the velocity into a wall, bounces 0.3 back, pushes 0.004 off and turns the car (0x00447cf0)', () => {
    // Arrange: driving along +x into a wall that faces -x.
    const hitting = {
      ...CAR,
      linearVelocity: { x: 0.1, y: 0, z: 0 },
      contactNormal: { x: -1, y: 0, z: 0 },
    }

    // Act
    const answered = respondToContact(SINGLE, hitting)

    // Assert
    const into = Math.fround(-0.1)
    const slid = Math.fround(Math.fround(0.1) - into * -1)
    const bounced = Math.fround(slid - -1 * Math.fround(Math.fround(0.3) * into))
    const pushed = Math.fround(Math.fround(-1 * Math.fround(0.004)) + bounced)
    expect(answered.linearVelocity.x).toBe(pushed)
    expect(answered.flags & CarRigidBodyFlag.WALL_TURN).toBe(CarRigidBodyFlag.WALL_TURN)
    expect(answered.yawTimer).toBe(200)
  })

  it('caps the rise speed at 0.3', () => {
    // Arrange
    const rising = {
      ...CAR,
      linearVelocity: { x: 0, y: 0, z: 1 },
      contactNormal: { x: 0, y: 0, z: 1 },
    }

    // Act
    const answered = respondToContact(SINGLE, rising)

    // Assert
    expect(answered.linearVelocity.z).toBe(Math.fround(0.3))
  })
})

describe('advanceToContact', () => {
  it('returns no time and leaves the body without contacts when nothing is hit', () => {
    // Arrange
    const body = CAR

    // Act
    const result = advanceToContact(SINGLE, body, 40, [], CAR_RIGID_BODY_HOOKS)

    // Assert
    expect(result.remainingMilliseconds).toBe(0)
    expect(result.body.contactCount).toBe(0)
  })
})
