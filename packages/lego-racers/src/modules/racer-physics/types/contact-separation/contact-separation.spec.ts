import {
  createFloatArithmetic,
  FpuPrecision,
  IDENTITY_MATRIX3,
} from '../../../simulation-math/index.ts'
import { createCarRigidBody } from '../car-rigid-body/car-rigid-body.ts'
import { moveOutOfContact } from './contact-separation.ts'

const arithmetic = createFloatArithmetic(FpuPrecision.SINGLE)
const CAR = createCarRigidBody(arithmetic, {
  displayFrame: { rotation: IDENTITY_MATRIX3, position: { x: 1, y: 2, z: 3 } },
  displayBoundingRadius: 5,
  mass: 2,
  dimensions: { x: 8, y: 5, z: 6.2 },
})

describe('moveOutOfContact, 0x004490b0', () => {
  it('moves the display frame and the body frame by the displacement from the display frame position', () => {
    // Arrange
    const body = { ...CAR, frame: { ...CAR.frame, position: { x: 10, y: 20, z: 30 } } }

    // Act
    const moved = moveOutOfContact(arithmetic, body, { x: 0.5, y: -1, z: 2 }, [])

    // Assert
    expect(moved.displayFrame.position).toEqual({ x: 1.5, y: 1, z: 5 })
    expect(moved.frame.position).toEqual({ x: 1.5, y: 1, z: 5 })
  })

  it('leaves the world centre of mass where it was and clears the contacts', () => {
    // Arrange
    const body = {
      ...CAR,
      worldCentreOfMass: { x: 4, y: 5, z: 6 },
      contactCount: 3,
      hullContacts: [true, true, true, true],
    }

    // Act
    const moved = moveOutOfContact(arithmetic, body, { x: 1, y: 1, z: 1 }, [])

    // Assert
    expect(moved.worldCentreOfMass).toEqual({ x: 4, y: 5, z: 6 })
    expect(moved.contactCount).toBe(0)
    expect(moved.hullContacts).toEqual([false, false, false, false])
  })
})
