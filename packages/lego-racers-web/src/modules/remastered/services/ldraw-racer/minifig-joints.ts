import { Matrix4, Quaternion, Vector3 } from 'three'
import { MinifigPartKey } from './minifig-assembly.types.ts'
import type { MinifigJoint } from './minifig-joints.types.ts'
import type { MinifigAttachment, MinifigRig } from './minifig-rig.types.ts'

const ARM_SPLAY = (9.78 * Math.PI) / 180
const SHOULDER_X = 15.552
const SHOULDER_Y = -15
const NECK_Y = -24
const WAIST_Y = 8
const HIP_X = 10
const HIP_Y = 12

// The standard joints of a LEGO minifigure, in the figure's own frame: the hips carry the torso and the legs, the torso the head and
// the arms (at the shoulders), an arm its hand. A part turns about its joint and nowhere else, so the parts cannot drift apart.
const JOINTS: Readonly<Record<MinifigPartKey, MinifigJoint>> = Object.freeze({
  [MinifigPartKey.HIPS]: { parentKey: null, pivot: [0, 0, 0] },
  [MinifigPartKey.TORSO]: { parentKey: MinifigPartKey.HIPS, pivot: [0, WAIST_Y, 0] },
  [MinifigPartKey.HEAD]: { parentKey: MinifigPartKey.TORSO, pivot: [0, NECK_Y, 0] },
  [MinifigPartKey.LEFT_ARM]: {
    parentKey: MinifigPartKey.TORSO,
    pivot: [SHOULDER_X, SHOULDER_Y, 0],
  },
  [MinifigPartKey.RIGHT_ARM]: {
    parentKey: MinifigPartKey.TORSO,
    pivot: [-SHOULDER_X, SHOULDER_Y, 0],
  },
  [MinifigPartKey.LEFT_HAND]: {
    parentKey: MinifigPartKey.LEFT_ARM,
    pivot: [SHOULDER_X, SHOULDER_Y, 0],
  },
  [MinifigPartKey.RIGHT_HAND]: {
    parentKey: MinifigPartKey.RIGHT_ARM,
    pivot: [-SHOULDER_X, SHOULDER_Y, 0],
  },
  [MinifigPartKey.LEFT_LEG]: { parentKey: MinifigPartKey.HIPS, pivot: [HIP_X, HIP_Y, 0] },
  [MinifigPartKey.RIGHT_LEG]: { parentKey: MinifigPartKey.HIPS, pivot: [-HIP_X, HIP_Y, 0] },
})

// Parents first, so a part's parent is placed before it.
const JOINT_ORDER: readonly MinifigPartKey[] = Object.freeze([
  MinifigPartKey.HIPS,
  MinifigPartKey.TORSO,
  MinifigPartKey.LEFT_LEG,
  MinifigPartKey.RIGHT_LEG,
  MinifigPartKey.HEAD,
  MinifigPartKey.LEFT_ARM,
  MinifigPartKey.RIGHT_ARM,
  MinifigPartKey.LEFT_HAND,
  MinifigPartKey.RIGHT_HAND,
])

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

// What carries a part now, as a turn from the bind pose: a bone's, or the turn that takes the chord between two bones from its bind
// direction to its present one. An arm splays outward as it hangs, the more the lower it hangs, as the library's own arms do.
const getAttachmentTurn = (
  attachment: MinifigAttachment,
  rest: readonly Matrix4[],
  pose: readonly Matrix4[]
): Matrix4 => {
  if (attachment.kind === 'bone') {
    return new Matrix4().extractRotation(getBoneChange(attachment.boneIndex, rest, pose))
  }
  const { startIndex, endIndex, outwardSign } = attachment
  const bindDirection = getBonePosition(rest, endIndex)
    .sub(getBonePosition(rest, startIndex))
    .normalize()
  const direction = getBonePosition(pose, endIndex)
    .sub(getBonePosition(pose, startIndex))
    .normalize()
  const hangingShare = Math.max(0, -direction.z)
  direction.y += outwardSign * Math.tan(ARM_SPLAY) * hangingShare
  return new Matrix4().makeRotationFromQuaternion(
    new Quaternion().setFromUnitVectors(bindDirection, direction.normalize())
  )
}

const getTurnAbout = (pivot: readonly [number, number, number], turn: Matrix4): Matrix4 =>
  new Matrix4()
    .makeTranslation(pivot[0], pivot[1], pivot[2])
    .multiply(turn)
    .multiply(new Matrix4().makeTranslation(-pivot[0], -pivot[1], -pivot[2]))

// Each part's matrix, which takes a place in the figure's frame to the model's. The figure is one assembly of parts at their standard
// joints: the hips follow the skeleton's pelvis, and every other part turns about its own joint by the turn of its bone (or chord)
// relative to its parent's, read from the original's pose.
export const getJointMatrices = (
  rig: MinifigRig,
  rest: readonly Matrix4[],
  pose: readonly Matrix4[],
  figureFrame: Matrix4
): ReadonlyMap<MinifigPartKey, Matrix4> => {
  const turns = new Map<MinifigPartKey, Matrix4>(
    JOINT_ORDER.map((key) => [key, getAttachmentTurn(rig.attachments[key], rest, pose)])
  )
  const hipsAttachment = rig.attachments[MinifigPartKey.HIPS]
  const hipsChange = getBoneChange(
    hipsAttachment.kind === 'bone' ? hipsAttachment.boneIndex : hipsAttachment.startIndex,
    rest,
    pose
  )
  const frameBasis = new Matrix4().extractRotation(figureFrame)
  const inverseFrameBasis = frameBasis.clone().invert()
  const matrices = new Map<MinifigPartKey, Matrix4>([
    [MinifigPartKey.HIPS, hipsChange.multiply(figureFrame)],
  ])
  for (const key of JOINT_ORDER) {
    const { parentKey, pivot } = JOINTS[key]
    const parentMatrix = parentKey === null ? undefined : matrices.get(parentKey)
    if (parentKey === null || parentMatrix === undefined) continue
    const parentTurn = turns.get(parentKey) ?? new Matrix4()
    const relativeTurn = parentTurn
      .clone()
      .invert()
      .multiply(turns.get(key) ?? new Matrix4())
    const figureTurn = inverseFrameBasis.clone().multiply(relativeTurn).multiply(frameBasis)
    matrices.set(key, parentMatrix.clone().multiply(getTurnAbout(pivot, figureTurn)))
  }
  return matrices
}
