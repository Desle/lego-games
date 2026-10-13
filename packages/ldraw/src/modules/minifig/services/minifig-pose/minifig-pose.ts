import { MathUtils, Matrix4, Quaternion, Vector3 } from 'three'
import { MINIFIG_GEOMETRY } from '../minifig-geometry/minifig-geometry.ts'
import type { MinifigHinge, MinifigSide } from '../minifig-geometry/minifig-geometry.types.ts'
import { MinifigRole } from '../minifig-roles/minifig-roles.types.ts'
import { MinifigJoint } from './minifig-pose.types.ts'
import type {
  MinifigJointAngles,
  MinifigJointLimit,
  MinifigJointLimits,
  MinifigPose,
  MinifigPoseMatrices,
  MinifigSwingJoint,
} from './minifig-pose.types.ts'

const DEGREE = Math.PI / 180
const FULL_TURN = Object.freeze({ minimum: -Math.PI, maximum: Math.PI })

// How far each hinge of a LEGO minifigure turns from the assembled standing figure: a leg swings forward to sit (and a little past it)
// and back about the hip axle; an arm, the head and a hand turn all the way round their pins.
export const MINIFIG_JOINT_LIMITS: MinifigJointLimits = Object.freeze({
  leg: Object.freeze({ minimum: -110 * DEGREE, maximum: 60 * DEGREE }),
  arm: FULL_TURN,
  neck: FULL_TURN,
  wrist: FULL_TURN,
})

const HANGING = new Vector3(0, 1, 0)
const FRONT = new Vector3(0, 0, -1)

// Where an arm's hand is as assembled, from its shoulder: a minifigure's arm is bent at the elbow, so its hand lies forward of
// straight down, and it is the hand that goes where an arm is swung toward.
const getHandReach = (side: MinifigSide): Vector3 =>
  new Vector3()
    .setFromMatrixPosition(MINIFIG_GEOMETRY.hands[side])
    .sub(MINIFIG_GEOMETRY.shoulders[side].pivot)

const JOINT_HINGES: Readonly<Record<MinifigJoint, MinifigHinge>> = Object.freeze({
  [MinifigJoint.NECK]: MINIFIG_GEOMETRY.neck,
  [MinifigJoint.LEFT_HIP]: MINIFIG_GEOMETRY.hip,
  [MinifigJoint.RIGHT_HIP]: MINIFIG_GEOMETRY.hip,
  [MinifigJoint.LEFT_SHOULDER]: MINIFIG_GEOMETRY.shoulders.left,
  [MinifigJoint.RIGHT_SHOULDER]: MINIFIG_GEOMETRY.shoulders.right,
  [MinifigJoint.LEFT_WRIST]: MINIFIG_GEOMETRY.wrists.left,
  [MinifigJoint.RIGHT_WRIST]: MINIFIG_GEOMETRY.wrists.right,
})

const JOINT_LIMITS: Readonly<Record<MinifigJoint, MinifigJointLimit>> = Object.freeze({
  [MinifigJoint.NECK]: MINIFIG_JOINT_LIMITS.neck,
  [MinifigJoint.LEFT_HIP]: MINIFIG_JOINT_LIMITS.leg,
  [MinifigJoint.RIGHT_HIP]: MINIFIG_JOINT_LIMITS.leg,
  [MinifigJoint.LEFT_SHOULDER]: MINIFIG_JOINT_LIMITS.arm,
  [MinifigJoint.RIGHT_SHOULDER]: MINIFIG_JOINT_LIMITS.arm,
  [MinifigJoint.LEFT_WRIST]: MINIFIG_JOINT_LIMITS.wrist,
  [MinifigJoint.RIGHT_WRIST]: MINIFIG_JOINT_LIMITS.wrist,
})

// Where the part a swing joint turns points as assembled, from its pivot: a leg hangs, an arm's hand reaches, the face looks ahead.
const REST_DIRECTIONS: Readonly<Record<MinifigSwingJoint, Vector3>> = Object.freeze({
  [MinifigJoint.NECK]: FRONT,
  [MinifigJoint.LEFT_HIP]: HANGING,
  [MinifigJoint.RIGHT_HIP]: HANGING,
  [MinifigJoint.LEFT_SHOULDER]: getHandReach('left'),
  [MinifigJoint.RIGHT_SHOULDER]: getHandReach('right'),
})

const getWrappedAngle = (angle: number): number =>
  MathUtils.euclideanModulo(angle + Math.PI, 2 * Math.PI) - Math.PI

// The turn about a joint's hinge that brings its part's far end nearest to a direction (the figure's frame), whatever of the direction
// lies along the hinge (a sideways reach a LEGO hinge cannot make) dropped.
export const getHingeAngle = (joint: MinifigSwingJoint, direction: Vector3): number => {
  const axis = JOINT_HINGES[joint].axis.clone().normalize()
  const reference = REST_DIRECTIONS[joint].clone().projectOnPlane(axis).normalize()
  const ahead = axis.clone().cross(reference)
  return getWrappedAngle(Math.atan2(direction.dot(ahead), direction.dot(reference)))
}

// The share of a turn about one axis (the twist of a swing and twist split), as an angle.
export const getTwistAngle = (turn: Matrix4, axis: Vector3): number => {
  const quaternion = new Quaternion().setFromRotationMatrix(turn)
  const along = new Vector3(quaternion.x, quaternion.y, quaternion.z).dot(axis.clone().normalize())
  return getWrappedAngle(2 * Math.atan2(along, quaternion.w))
}

export const getClampedAngle = (joint: MinifigJoint, angle: number): number =>
  MathUtils.clamp(angle, JOINT_LIMITS[joint].minimum, JOINT_LIMITS[joint].maximum)

// A pose from the angles given (the rest of the hinges as assembled) about a root (the identity: the assembled figure).
export const createMinifigPose = (
  angles: Partial<MinifigJointAngles> = {},
  root: Matrix4 = new Matrix4()
): MinifigPose =>
  Object.freeze({
    root,
    angles: Object.freeze({
      [MinifigJoint.NECK]: angles[MinifigJoint.NECK] ?? 0,
      [MinifigJoint.LEFT_HIP]: angles[MinifigJoint.LEFT_HIP] ?? 0,
      [MinifigJoint.RIGHT_HIP]: angles[MinifigJoint.RIGHT_HIP] ?? 0,
      [MinifigJoint.LEFT_SHOULDER]: angles[MinifigJoint.LEFT_SHOULDER] ?? 0,
      [MinifigJoint.RIGHT_SHOULDER]: angles[MinifigJoint.RIGHT_SHOULDER] ?? 0,
      [MinifigJoint.LEFT_WRIST]: angles[MinifigJoint.LEFT_WRIST] ?? 0,
      [MinifigJoint.RIGHT_WRIST]: angles[MinifigJoint.RIGHT_WRIST] ?? 0,
    }),
  })

const getTurnAbout = (hinge: MinifigHinge, angle: number): Matrix4 =>
  new Matrix4()
    .makeTranslation(hinge.pivot.x, hinge.pivot.y, hinge.pivot.z)
    .multiply(new Matrix4().makeRotationAxis(hinge.axis.clone().normalize(), angle))
    .multiply(new Matrix4().makeTranslation(-hinge.pivot.x, -hinge.pivot.y, -hinge.pivot.z))

const getJointTurn = (pose: MinifigPose, joint: MinifigJoint): Matrix4 =>
  getTurnAbout(JOINT_HINGES[joint], getClampedAngle(joint, pose.angles[joint]))

// Each part's matrix for a pose, as a LEGO minifigure moves: the hips and torso are one piece on the root; each leg swings on the hip
// axle and each arm on its shoulder pin; the head and what is worn on it turn on the neck; a hand turns on its pin at the end of its
// arm. Every angle is held to its hinge's limits.
export const poseMinifig = (pose: MinifigPose): MinifigPoseMatrices => {
  const { root } = pose
  const head = root.clone().multiply(getJointTurn(pose, MinifigJoint.NECK))
  const leftArm = root.clone().multiply(getJointTurn(pose, MinifigJoint.LEFT_SHOULDER))
  const rightArm = root.clone().multiply(getJointTurn(pose, MinifigJoint.RIGHT_SHOULDER))
  return Object.freeze({
    [MinifigRole.HIPS]: root.clone(),
    [MinifigRole.TORSO]: root.clone(),
    [MinifigRole.LEFT_LEG]: root.clone().multiply(getJointTurn(pose, MinifigJoint.LEFT_HIP)),
    [MinifigRole.RIGHT_LEG]: root.clone().multiply(getJointTurn(pose, MinifigJoint.RIGHT_HIP)),
    [MinifigRole.HEAD]: head,
    [MinifigRole.HAT]: head.clone(),
    [MinifigRole.ACCESSORY]: head.clone(),
    [MinifigRole.LEFT_ARM]: leftArm,
    [MinifigRole.RIGHT_ARM]: rightArm,
    [MinifigRole.LEFT_HAND]: leftArm.clone().multiply(getJointTurn(pose, MinifigJoint.LEFT_WRIST)),
    [MinifigRole.RIGHT_HAND]: rightArm
      .clone()
      .multiply(getJointTurn(pose, MinifigJoint.RIGHT_WRIST)),
  })
}
