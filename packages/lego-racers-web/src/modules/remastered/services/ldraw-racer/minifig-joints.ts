import { MathUtils, Matrix4, Quaternion, Vector3 } from 'three'
import { MinifigPartKey } from './minifig-assembly.types.ts'
import { MINIFIG_GEOMETRY, MINIFIG_SIDES } from './minifig-geometry.ts'
import type { MinifigHinge, MinifigSide } from './minifig-geometry.types.ts'
import type {
  MinifigJointLimit,
  MinifigJointLimits,
  MinifigSideParts,
} from './minifig-joints.types.ts'
import type { MinifigLimbAttachment, MinifigRig } from './minifig-rig.types.ts'

const DEGREE = Math.PI / 180

// How far each hinge of a LEGO minifigure turns, as its turn from the assembled standing figure: a leg swings forward to sit (and a
// little past it) and back about the hip axle; an arm turns all the way round its shoulder pin; the head turns on the neck; a hand
// twists on its pin.
export const MINIFIG_JOINT_LIMITS: MinifigJointLimits = Object.freeze({
  leg: Object.freeze({ minimum: -110 * DEGREE, maximum: 60 * DEGREE }),
  arm: Object.freeze({ minimum: -Math.PI, maximum: Math.PI }),
  neck: Object.freeze({ minimum: -135 * DEGREE, maximum: 135 * DEGREE }),
  wrist: Object.freeze({ minimum: -90 * DEGREE, maximum: 90 * DEGREE }),
})

const SIDE_PARTS: Readonly<Record<MinifigSide, MinifigSideParts>> = Object.freeze({
  left: Object.freeze({
    leg: MinifigPartKey.LEFT_LEG,
    arm: MinifigPartKey.LEFT_ARM,
    hand: MinifigPartKey.LEFT_HAND,
  }),
  right: Object.freeze({
    leg: MinifigPartKey.RIGHT_LEG,
    arm: MinifigPartKey.RIGHT_ARM,
    hand: MinifigPartKey.RIGHT_HAND,
  }),
})

const getBonePosition = (matrices: readonly Matrix4[], boneIndex: number): Vector3 => {
  const matrix = matrices[boneIndex]
  return matrix === undefined ? new Vector3() : new Vector3().setFromMatrixPosition(matrix)
}

// A bone's matrix as a change of the bind pose: its present matrix with the bind pose's undone.
const getBoneChange = (
  boneIndex: number,
  rest: readonly Matrix4[],
  pose: readonly Matrix4[]
): Matrix4 => {
  const restMatrix = rest[boneIndex]
  const poseMatrix = pose[boneIndex]
  return restMatrix === undefined || poseMatrix === undefined
    ? new Matrix4()
    : poseMatrix.clone().multiply(restMatrix.clone().invert())
}

const getBoneTurn = (boneIndex: number, rest: readonly Matrix4[], pose: readonly Matrix4[]) =>
  new Matrix4().extractRotation(getBoneChange(boneIndex, rest, pose))

// Which way a limb points now, in the model's frame.
const getLimbDirection = (
  attachment: MinifigLimbAttachment,
  rest: readonly Matrix4[],
  pose: readonly Matrix4[],
  frameBasis: Matrix4
): Vector3 => {
  if (attachment.kind === 'chord') {
    return getBonePosition(pose, attachment.endIndex)
      .sub(getBonePosition(pose, attachment.startIndex))
      .normalize()
  }
  const [x, y, z] = attachment.bindDirection
  return new Vector3(x, y, z)
    .applyMatrix4(frameBasis)
    .applyMatrix4(getBoneTurn(attachment.boneIndex, rest, pose))
    .normalize()
}

const getClamped = (angle: number, limits: MinifigJointLimit): number =>
  MathUtils.clamp(angle, limits.minimum, limits.maximum)

const HANGING = new Vector3(0, 1, 0)

const getAngleAbout = (hinge: MinifigHinge, direction: Vector3): number => {
  const axis = hinge.axis.clone().normalize()
  const hanging = HANGING.clone().projectOnPlane(axis).normalize()
  const forward = axis.clone().cross(hanging)
  return Math.atan2(direction.dot(forward), direction.dot(hanging))
}

// The turn about a hinge that brings a part's far end (`restDirection` from the pivot as assembled; a leg hangs straight down) nearest
// to a direction: the direction's angle about the axis less the far end's, whatever of it lies along the axis (a sideways reach a LEGO
// hinge cannot make) dropped.
const getSwingAngle = (
  hinge: MinifigHinge,
  direction: Vector3,
  restDirection: Vector3 = HANGING
): number => getAngleAbout(hinge, direction) - getAngleAbout(hinge, restDirection)

// Where an arm's hand is as assembled, from its shoulder: a minifigure's arm is bent at the elbow, so its hand lies forward of
// straight down, and it is the hand that goes where the skeleton's arm reaches.
const getHandReach = (side: MinifigSide): Vector3 =>
  new Vector3()
    .setFromMatrixPosition(MINIFIG_GEOMETRY.hands[side])
    .sub(MINIFIG_GEOMETRY.shoulders[side].pivot)

// The share of a turn about one axis (the twist of a swing and twist split), as an angle.
const getTwistAngle = (turn: Matrix4, axis: Vector3): number => {
  const quaternion = new Quaternion().setFromRotationMatrix(turn)
  const along = new Vector3(quaternion.x, quaternion.y, quaternion.z).dot(axis.clone().normalize())
  return (
    MathUtils.euclideanModulo(2 * Math.atan2(along, quaternion.w) + Math.PI, 2 * Math.PI) - Math.PI
  )
}

const getTurnAbout = (hinge: MinifigHinge, angle: number): Matrix4 =>
  new Matrix4()
    .makeTranslation(hinge.pivot.x, hinge.pivot.y, hinge.pivot.z)
    .multiply(new Matrix4().makeRotationAxis(hinge.axis.clone().normalize(), angle))
    .multiply(new Matrix4().makeTranslation(-hinge.pivot.x, -hinge.pivot.y, -hinge.pivot.z))

const getWristAngle = (
  rig: MinifigRig,
  side: MinifigSide,
  rest: readonly Matrix4[],
  pose: readonly Matrix4[]
): number => {
  const wrist = rig.wrists?.[side]
  if (wrist === undefined) return 0
  const forearm = getBonePosition(rest, wrist.wristIndex).sub(
    getBonePosition(rest, wrist.forearmIndex)
  )
  const turn = getBoneTurn(wrist.forearmIndex, rest, pose)
    .invert()
    .multiply(getBoneTurn(wrist.handIndex, rest, pose))
  // A hand's pin points back up its arm, against the forearm.
  return getClamped(-getTwistAngle(turn, forearm), MINIFIG_JOINT_LIMITS.wrist)
}

// Each part's matrix, which takes a place in the figure's frame to the model's. The figure is the library's assembly (`minifig-geometry`)
// and moves only as a LEGO minifigure can: the torso and the hips are one piece that the pelvis carries by the hip axle and the torso
// bone turns; each leg swings on the hip axle and each arm on its shoulder pin toward where the skeleton's limb points; the head turns
// on the neck by the head bone's turn about it; a hand twists on its pin by the hand bone's twist.
export const getJointMatrices = (
  rig: MinifigRig,
  rest: readonly Matrix4[],
  pose: readonly Matrix4[],
  figureFrame: Matrix4
): ReadonlyMap<MinifigPartKey, Matrix4> => {
  const frameBasis = new Matrix4().extractRotation(figureFrame)
  const inverseFrameBasis = frameBasis.clone().invert()
  const toFigure = (turn: Matrix4) => inverseFrameBasis.clone().multiply(turn).multiply(frameBasis)
  const pelvisTurn = getBoneTurn(rig.pelvisIndex, rest, pose)
  const torsoTurn = getBoneTurn(rig.torsoIndex, rest, pose)
  const torsoOnPelvis = toFigure(pelvisTurn.clone().invert().multiply(torsoTurn))
  const hip = MINIFIG_GEOMETRY.hip
  const body = getBoneChange(rig.pelvisIndex, rest, pose)
    .multiply(figureFrame)
    .multiply(
      new Matrix4()
        .makeTranslation(hip.pivot.x, hip.pivot.y, hip.pivot.z)
        .multiply(torsoOnPelvis)
        .multiply(new Matrix4().makeTranslation(-hip.pivot.x, -hip.pivot.y, -hip.pivot.z))
    )
  const inverseBodyBasis = new Matrix4().extractRotation(body).invert()
  const getDirectionOnBody = (attachment: MinifigLimbAttachment) =>
    getLimbDirection(attachment, rest, pose, frameBasis).applyMatrix4(inverseBodyBasis).normalize()
  const headOnTorso = toFigure(
    torsoTurn
      .clone()
      .invert()
      .multiply(getBoneTurn(rig.headIndex, rest, pose))
  )
  const neckAngle = getClamped(
    getTwistAngle(headOnTorso, MINIFIG_GEOMETRY.neck.axis),
    MINIFIG_JOINT_LIMITS.neck
  )
  const matrices = new Map<MinifigPartKey, Matrix4>([
    [MinifigPartKey.HIPS, body],
    [MinifigPartKey.TORSO, body.clone()],
    [MinifigPartKey.HEAD, body.clone().multiply(getTurnAbout(MINIFIG_GEOMETRY.neck, neckAngle))],
  ])
  for (const side of MINIFIG_SIDES) {
    const keys = SIDE_PARTS[side]
    const legAngle = getClamped(
      getSwingAngle(hip, getDirectionOnBody(rig.limbs.legs[side])),
      MINIFIG_JOINT_LIMITS.leg
    )
    const shoulder = MINIFIG_GEOMETRY.shoulders[side]
    const armAngle = getClamped(
      getSwingAngle(shoulder, getDirectionOnBody(rig.limbs.arms[side]), getHandReach(side)),
      MINIFIG_JOINT_LIMITS.arm
    )
    const arm = body.clone().multiply(getTurnAbout(shoulder, armAngle))
    const hand = arm
      .clone()
      .multiply(getTurnAbout(MINIFIG_GEOMETRY.wrists[side], getWristAngle(rig, side, rest, pose)))
    matrices.set(keys.leg, body.clone().multiply(getTurnAbout(hip, legAngle)))
    matrices.set(keys.arm, arm)
    matrices.set(keys.hand, hand)
  }
  return matrices
}
