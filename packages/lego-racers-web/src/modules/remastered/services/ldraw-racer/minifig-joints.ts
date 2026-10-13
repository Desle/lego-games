import { Matrix4, Vector3 } from 'three'
import {
  MINIFIG_GEOMETRY,
  MinifigJoint,
  createMinifigPose,
  getHingeAngle,
  getTwistAngle,
} from '@lego-games/ldraw/minifig'
import type { MinifigPose, MinifigSide } from '@lego-games/ldraw/minifig'
import type { MinifigLimbAttachment, MinifigRig } from './minifig-rig.types.ts'

const SIDE_JOINTS = Object.freeze({
  left: Object.freeze({
    hip: MinifigJoint.LEFT_HIP,
    shoulder: MinifigJoint.LEFT_SHOULDER,
    wrist: MinifigJoint.LEFT_WRIST,
  }),
  right: Object.freeze({
    hip: MinifigJoint.RIGHT_HIP,
    shoulder: MinifigJoint.RIGHT_SHOULDER,
    wrist: MinifigJoint.RIGHT_WRIST,
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
  return -getTwistAngle(turn, forearm)
}

// The minifigure's pose for a frame of the original's skeleton (raw model units, `figureFrame` taking the figure's frame to the
// model's): the torso and hips, one piece, are carried by the pelvis at the hip axle and lean there by the torso bone's turn; each leg
// and arm swings toward where the skeleton's limb points; the head turns by the head bone's turn about the neck; a hand by the hand
// bone's twist about the forearm.
export const getMinifigPose = (
  rig: MinifigRig,
  rest: readonly Matrix4[],
  pose: readonly Matrix4[],
  figureFrame: Matrix4
): MinifigPose => {
  const frameBasis = new Matrix4().extractRotation(figureFrame)
  const inverseFrameBasis = frameBasis.clone().invert()
  const toFigure = (turn: Matrix4) => inverseFrameBasis.clone().multiply(turn).multiply(frameBasis)
  const pelvisTurn = getBoneTurn(rig.pelvisIndex, rest, pose)
  const torsoTurn = getBoneTurn(rig.torsoIndex, rest, pose)
  const torsoOnPelvis = toFigure(pelvisTurn.clone().invert().multiply(torsoTurn))
  const { pivot } = MINIFIG_GEOMETRY.hip
  const root = getBoneChange(rig.pelvisIndex, rest, pose)
    .multiply(figureFrame)
    .multiply(
      new Matrix4()
        .makeTranslation(pivot.x, pivot.y, pivot.z)
        .multiply(torsoOnPelvis)
        .multiply(new Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z))
    )
  const inverseRootBasis = new Matrix4().extractRotation(root).invert()
  const getDirectionOnRoot = (attachment: MinifigLimbAttachment) =>
    getLimbDirection(attachment, rest, pose, frameBasis).applyMatrix4(inverseRootBasis).normalize()
  const headOnTorso = toFigure(
    torsoTurn
      .clone()
      .invert()
      .multiply(getBoneTurn(rig.headIndex, rest, pose))
  )
  const getSideAngles = (side: MinifigSide) => ({
    [SIDE_JOINTS[side].hip]: getHingeAngle(
      SIDE_JOINTS[side].hip,
      getDirectionOnRoot(rig.limbs.legs[side])
    ),
    [SIDE_JOINTS[side].shoulder]: getHingeAngle(
      SIDE_JOINTS[side].shoulder,
      getDirectionOnRoot(rig.limbs.arms[side])
    ),
    [SIDE_JOINTS[side].wrist]: getWristAngle(rig, side, rest, pose),
  })
  return createMinifigPose(
    {
      [MinifigJoint.NECK]: getTwistAngle(headOnTorso, MINIFIG_GEOMETRY.neck.axis),
      ...getSideAngles('left'),
      ...getSideAngles('right'),
    },
    root
  )
}
