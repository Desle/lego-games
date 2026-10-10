import {
  createFloatArithmetic,
  FpuPrecision,
  IDENTITY_MATRIX3,
} from '../../../simulation-math/index.ts'
import {
  createCarRigidBody,
  getRestoredStepStart,
  saveStepStart,
  setHullPoint,
  setLocalCentreOfMass,
  setWheelGeometry,
} from './car-rigid-body.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)

const CAR = createCarRigidBody(SINGLE, {
  displayFrame: { rotation: IDENTITY_MATRIX3, position: { x: 10, y: 20, z: 30 } },
  displayBoundingRadius: 5,
  mass: 1000,
  dimensions: { x: 8, y: 5, z: 6.2 },
})

describe('createCarRigidBody', () => {
  it('takes the defaults of 0x00444b40 and the setup of 0x00444d90', () => {
    // Arrange
    const definitionMass = 1000

    // Act
    const body = CAR

    // Assert
    expect(body.scaledMass).toBe(
      Math.fround(definitionMass * Math.fround(0.001) * Math.fround(0.001))
    )
    expect(body.gravity).toBe(39)
    expect(body.topSpeed).toBe(110)
    expect(body.settleOffset).toEqual({ x: 0, y: 0, z: Math.fround(0.2) })
    expect(body.heading).toEqual({ x: 1, y: 0, z: 0 })
    expect(body.frame.position).toEqual({ x: 10, y: 20, z: 30 })
    expect(body.wheels).toHaveLength(4)
    expect(body.driftMaximumAngle).toBe(Math.fround(Math.PI))
  })
})

describe('setWheelGeometry', () => {
  it('puts wheel 1 at the frame point and the others a track width and wheelbase behind (0x00448c70)', () => {
    // Arrange
    const anchor = { x: 3, y: 2, z: -1 }

    // Act
    const body = setWheelGeometry(SINGLE, CAR, anchor, 4, 6)

    // Assert
    expect(body.wheels.map((wheel) => wheel.anchor)).toEqual([
      { x: 13, y: 18, z: 29 },
      { x: 13, y: 22, z: 29 },
      { x: 7, y: 18, z: 29 },
      { x: 7, y: 22, z: 29 },
    ])
  })
})

describe('step start snapshots', () => {
  it('saves and restores the fields of 0x004474c0 and 0x00447690, but not the rest', () => {
    // Arrange
    const saved = saveStepStart(
      setHullPoint(SINGLE, setLocalCentreOfMass(SINGLE, CAR, { x: 1, y: 0, z: 0 }), 0, {
        x: 1,
        y: 1,
        z: 1,
      })
    )
    const moved = {
      ...saved,
      linearVelocity: { x: 5, y: 5, z: 5 },
      frame: { ...saved.frame, position: { x: 0, y: 0, z: 0 } },
      groundedWheelCount: 3,
    }

    // Act
    const restored = getRestoredStepStart(moved)

    // Assert
    expect(restored.linearVelocity).toEqual({ x: 0, y: 0, z: 0 })
    expect(restored.frame.position).toEqual({ x: 10, y: 20, z: 30 })
    expect(restored.worldHullPoints[0]).toEqual({ x: 11, y: 21, z: 31 })
    expect(restored.groundedWheelCount).toBe(3)
    expect(saved.worldCentreOfMass).toEqual({ x: 11, y: 20, z: 30 })
  })
})
