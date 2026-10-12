import { MinifigPartKey, MinifigPosture } from './minifig-assembly.types.ts'
import type { MinifigAttachment, MinifigRig } from './minifig-rig.types.ts'

const SEATED_BONE_COUNT = 6
// A figure's torso spans y -24 to 8 in its own frame; the bind pose's torso spans these heights (raw model units): the seated skeleton's
// torso bone to its head bone, the standing skeleton's waist to its neck. A minifigure is 3.2 raw units to an LDraw unit (a stud is 64 and 20).
const SEATED_HIPS_HEIGHT = 75.9
const STANDING_HIPS_HEIGHT = 58

const getBone = (boneIndex: number): MinifigAttachment => ({ kind: 'bone', boneIndex })

const findBone = (boneNames: readonly string[], pattern: RegExp): number =>
  boneNames.findIndex((name) => pattern.test(name))

const getChordOrBone = (
  boneNames: readonly string[],
  startPattern: RegExp,
  endPattern: RegExp,
  outwardSign = 0
): MinifigAttachment => {
  const startIndex = findBone(boneNames, startPattern)
  const endIndex = findBone(boneNames, endPattern)
  return startIndex < 0 || endIndex < 0
    ? getBone(Math.max(startIndex, 0))
    : { kind: 'chord', startIndex, endIndex, outwardSign }
}

// The skeleton of the race driver and the figure builder's drivers: pelvis, torso, two arms, a dummy that carries the hat and head, a head.
const getSeatedRig = (): MinifigRig =>
  Object.freeze({
    posture: MinifigPosture.SEATED,
    hipsHeight: SEATED_HIPS_HEIGHT,
    attachments: Object.freeze({
      [MinifigPartKey.HIPS]: getBone(0),
      [MinifigPartKey.LEFT_LEG]: getBone(0),
      [MinifigPartKey.RIGHT_LEG]: getBone(0),
      [MinifigPartKey.TORSO]: getBone(1),
      [MinifigPartKey.HEAD]: getBone(4),
      [MinifigPartKey.LEFT_ARM]: getBone(2),
      [MinifigPartKey.RIGHT_ARM]: getBone(3),
      [MinifigPartKey.LEFT_HAND]: getBone(2),
      [MinifigPartKey.RIGHT_HAND]: getBone(3),
    }),
  })

// The skeleton of the menus' figures (`rr`, `hr`, `rp`, `hp`: thigh, knee, ankle, foot and toe chains, waist, chest, neck, head, and a
// shoulder, elbow, wrist and hand for each arm), whose bind pose has the arms out sideways.
const getStandingRig = (boneNames: readonly string[]): MinifigRig => {
  const leftArm = getChordOrBone(boneNames, /^l_sh/, /^l_wr/, 1)
  const rightArm = getChordOrBone(boneNames, /^r_sh/, /^r_wr/, -1)
  return Object.freeze({
    posture: MinifigPosture.STANDING,
    hipsHeight: STANDING_HIPS_HEIGHT,
    attachments: Object.freeze({
      [MinifigPartKey.HIPS]: getBone(0),
      [MinifigPartKey.LEFT_LEG]: getChordOrBone(boneNames, /^l_th/, /^l_an/),
      [MinifigPartKey.RIGHT_LEG]: getChordOrBone(boneNames, /^r_th/, /^r_an/),
      [MinifigPartKey.TORSO]: getBone(Math.max(findBone(boneNames, /^chest/), 0)),
      [MinifigPartKey.HEAD]: getBone(Math.max(findBone(boneNames, /^head/), 0)),
      [MinifigPartKey.LEFT_ARM]: leftArm,
      [MinifigPartKey.RIGHT_ARM]: rightArm,
      // The hand is the end of the arm, so it follows the arm's line (one rigid piece does not meet a hand that turns on its own).
      [MinifigPartKey.LEFT_HAND]: leftArm,
      [MinifigPartKey.RIGHT_HAND]: rightArm,
    }),
  })
}

// How a minifigure's parts follow a driver's skeleton: the seated or the standing one, told apart by their bones; null for a skeleton
// that is neither.
export const getMinifigRig = (boneNames: readonly string[]): MinifigRig | null => {
  if (boneNames.length === SEATED_BONE_COUNT && boneNames[1] === 'torso') return getSeatedRig()
  if (findBone(boneNames, /^chest/) >= 0 && findBone(boneNames, /^head/) >= 0) {
    return getStandingRig(boneNames)
  }
  return null
}
