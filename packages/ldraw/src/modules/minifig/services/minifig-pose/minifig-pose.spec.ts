import { Matrix4, Vector3 } from 'three'
import { MINIFIG_GEOMETRY } from '../minifig-geometry/minifig-geometry.ts'
import type { MinifigHinge } from '../minifig-geometry/minifig-geometry.types.ts'
import { MinifigRole } from '../minifig-roles/minifig-roles.types.ts'
import {
  MINIFIG_JOINT_LIMITS,
  createMinifigPose,
  getHingeAngle,
  getTwistAngle,
  poseMinifig,
} from './minifig-pose.ts'
import { MinifigJoint } from './minifig-pose.types.ts'
import type { MinifigPoseMatrices } from './minifig-pose.types.ts'

const TOLERANCE = 1e-9
const QUARTER_TURN = Math.PI / 2

// The part each joint turns, and the hinge it turns on.
const JOINT_PARTS: readonly (readonly [MinifigJoint, MinifigRole, MinifigHinge])[] = [
  [MinifigJoint.NECK, MinifigRole.HEAD, MINIFIG_GEOMETRY.neck],
  [MinifigJoint.LEFT_HIP, MinifigRole.LEFT_LEG, MINIFIG_GEOMETRY.hip],
  [MinifigJoint.RIGHT_HIP, MinifigRole.RIGHT_LEG, MINIFIG_GEOMETRY.hip],
  [MinifigJoint.LEFT_SHOULDER, MinifigRole.LEFT_ARM, MINIFIG_GEOMETRY.shoulders.left],
  [MinifigJoint.RIGHT_SHOULDER, MinifigRole.RIGHT_ARM, MINIFIG_GEOMETRY.shoulders.right],
  [MinifigJoint.LEFT_WRIST, MinifigRole.LEFT_HAND, MINIFIG_GEOMETRY.wrists.left],
  [MinifigJoint.RIGHT_WRIST, MinifigRole.RIGHT_HAND, MINIFIG_GEOMETRY.wrists.right],
]

const getPlaced = (point: Vector3, matrix: Matrix4) => point.clone().applyMatrix4(matrix)

// How far a part's matrix moves a point off the hinge, and whether it leaves the hinge's pivot and axis where they are.
const getIsTurnAbout = (matrix: Matrix4, hinge: MinifigHinge): boolean => {
  const isPivotKept = getPlaced(hinge.pivot, matrix).distanceTo(hinge.pivot) < TOLERANCE
  const axisEnd = hinge.pivot.clone().add(hinge.axis)
  return isPivotKept && getPlaced(axisEnd, matrix).distanceTo(axisEnd) < TOLERANCE
}

const getTurnedAngle = (matrices: MinifigPoseMatrices, role: MinifigRole, joint: MinifigJoint) =>
  getTwistAngle(
    new Matrix4().extractRotation(matrices[role]),
    JOINT_PARTS.find(([candidate]) => candidate === joint)?.[2].axis ?? new Vector3()
  )

describe('poseMinifig', () => {
  it('keeps every part where the library assembles it in the rest pose, on the root', () => {
    // Arrange
    const root = new Matrix4().makeTranslation(5, -7, 11)

    // Act
    const matrices = poseMinifig(createMinifigPose({}, root))

    // Assert
    expect(Object.values(MinifigRole).every((role) => matrices[role].equals(root))).toBe(true)
  })

  it.each(JOINT_PARTS)(
    'turns at %s only the part on it, about its own hinge',
    (joint, role, hinge) => {
      // Arrange
      const pose = createMinifigPose({ [joint]: 0.5 })

      // Act
      const matrices = poseMinifig(pose)

      // Assert
      expect(getIsTurnAbout(matrices[role], hinge)).toBe(true)
      expect(matrices[role].equals(new Matrix4())).toBe(false)
      expect(matrices[MinifigRole.TORSO].equals(new Matrix4())).toBe(true)
    }
  )

  it('carries a hand with its arm and the hat and its accessory with the head', () => {
    // Arrange
    const pose = createMinifigPose({
      [MinifigJoint.LEFT_SHOULDER]: 1,
      [MinifigJoint.NECK]: 1,
    })

    // Act
    const matrices = poseMinifig(pose)

    // Assert
    expect(matrices[MinifigRole.LEFT_HAND].equals(matrices[MinifigRole.LEFT_ARM])).toBe(true)
    expect(matrices[MinifigRole.HAT].equals(matrices[MinifigRole.HEAD])).toBe(true)
    expect(matrices[MinifigRole.ACCESSORY].equals(matrices[MinifigRole.HEAD])).toBe(true)
  })

  it('holds a leg to the furthest a minifigure leg swings, and lets the head, the arms and the hands turn all the way round', () => {
    // Arrange
    const pose = createMinifigPose({
      [MinifigJoint.LEFT_HIP]: 2,
      [MinifigJoint.RIGHT_HIP]: -3,
      [MinifigJoint.NECK]: 3,
      [MinifigJoint.LEFT_SHOULDER]: -3,
      [MinifigJoint.LEFT_WRIST]: 3,
    })

    // Act
    const matrices = poseMinifig(pose)

    // Assert
    expect([
      getTurnedAngle(matrices, MinifigRole.LEFT_LEG, MinifigJoint.LEFT_HIP),
      getTurnedAngle(matrices, MinifigRole.RIGHT_LEG, MinifigJoint.RIGHT_HIP),
      getTurnedAngle(matrices, MinifigRole.HEAD, MinifigJoint.NECK),
      getTurnedAngle(matrices, MinifigRole.LEFT_ARM, MinifigJoint.LEFT_SHOULDER),
    ]).toEqual([
      expect.closeTo(MINIFIG_JOINT_LIMITS.leg.maximum, 9),
      expect.closeTo(MINIFIG_JOINT_LIMITS.leg.minimum, 9),
      expect.closeTo(3, 9),
      expect.closeTo(-3, 9),
    ])
    expect(
      getTwistAngle(
        new Matrix4()
          .extractRotation(matrices[MinifigRole.LEFT_ARM])
          .invert()
          .multiply(new Matrix4().extractRotation(matrices[MinifigRole.LEFT_HAND])),
        MINIFIG_GEOMETRY.wrists.left.axis
      )
    ).toBeCloseTo(3, 9)
  })
})

describe('getHingeAngle', () => {
  it('swings a leg forward to point ahead, dropping a sideways reach the hip cannot make', () => {
    // Arrange
    const aheadAndOut = new Vector3(0.6, 0, -1)

    // Act
    const angle = getHingeAngle(MinifigJoint.LEFT_HIP, aheadAndOut)

    // Assert
    expect(angle).toBeCloseTo(-QUARTER_TURN, 9)
  })

  it('turns the head toward where it is to look', () => {
    // Arrange
    const toTheLeft = new Vector3(1, 0, 0)

    // Act
    const angle = getHingeAngle(MinifigJoint.NECK, toTheLeft)
    const face = new Vector3(0, 0, -1).transformDirection(
      poseMinifig(createMinifigPose({ [MinifigJoint.NECK]: angle }))[MinifigRole.HEAD]
    )

    // Assert
    expect(face.distanceTo(toTheLeft)).toBeLessThan(TOLERANCE)
  })

  it('puts the hand where an arm is swung toward, not the straight arm', () => {
    // Arrange
    const shoulder = MINIFIG_GEOMETRY.shoulders.left
    const ahead = new Vector3(0, 0, -1)

    // Act
    const angle = getHingeAngle(MinifigJoint.LEFT_SHOULDER, ahead)
    const hand = getPlaced(
      new Vector3().setFromMatrixPosition(MINIFIG_GEOMETRY.hands.left),
      poseMinifig(createMinifigPose({ [MinifigJoint.LEFT_SHOULDER]: angle }))[MinifigRole.LEFT_ARM]
    )
    const reach = hand.sub(shoulder.pivot).projectOnPlane(shoulder.axis.clone().normalize())

    // Assert
    expect(reach.normalize().angleTo(ahead.clone().projectOnPlane(shoulder.axis))).toBeLessThan(
      1e-6
    )
  })
})

describe('getTwistAngle', () => {
  it('keeps only the share of a turn about the axis', () => {
    // Arrange
    const turn = new Matrix4().makeRotationY(0.7).multiply(new Matrix4().makeRotationX(0.3))

    // Act
    const angle = getTwistAngle(turn, new Vector3(0, 1, 0))

    // Assert
    expect(angle).toBeCloseTo(0.7, 9)
  })
})
