import { MinifigPosture } from './minifig-rig.types.ts'
import type { MinifigSide } from '@lego-games/ldraw/minifig'
import type {
  MinifigLimbAttachment,
  MinifigRig,
  MinifigWristAttachment,
} from './minifig-rig.types.ts'

const SEATED_BONE_COUNT = 6
// The race driver's torso block starts at z 45 (14.1 LDraw units) on a pelvis block only 14 high, where a seated minifigure's legs lie
// 22 below the top of its hips: the hips' top goes under the torso, so what shows above the car (torso, arms, head) sits where the
// original's does, and the legs reach 8 LDraw units further down into the seat.
const SEATED_HIPS_HEIGHT = 45.1
// The menu figure's hip block reaches up to z 32.8, its feet down to -95.2: 40 LDraw units (the hips' top to the soles) below.
const STANDING_HIPS_HEIGHT = 32.8
// The race driver's arms (`arm_l`, `arm_r`) reach forward and 14 degrees below the horizontal: the principal axis of their vertices.
const SEATED_ARM_DROP = (14 * Math.PI) / 180
const SEATED_ARM_DIRECTION = Object.freeze([
  0,
  Math.sin(SEATED_ARM_DROP),
  -Math.cos(SEATED_ARM_DROP),
] as const)
// The race driver's legs are the pelvis's box, reaching forward.
const SEATED_LEG_DIRECTION = Object.freeze([0, 0, -1] as const)
const SIDE_PREFIXES: Readonly<Record<MinifigSide, string>> = Object.freeze({
  left: 'l_',
  right: 'r_',
})

const getBone = (
  boneIndex: number,
  bindDirection: readonly [number, number, number]
): MinifigLimbAttachment => Object.freeze({ kind: 'bone', boneIndex, bindDirection })

const findBone = (boneNames: readonly string[], pattern: RegExp): number =>
  boneNames.findIndex((name) => pattern.test(name))

const findSideBone = (boneNames: readonly string[], side: MinifigSide, stem: string): number =>
  boneNames.findIndex((name) => name.startsWith(`${SIDE_PREFIXES[side]}${stem}`))

// A rigid limb along the line from one bone to another; straight down (a hanging limb) when the skeleton lacks either.
const getChord = (
  boneNames: readonly string[],
  side: MinifigSide,
  startStem: string,
  endStem: string
): MinifigLimbAttachment => {
  const startIndex = findSideBone(boneNames, side, startStem)
  const endIndex = findSideBone(boneNames, side, endStem)
  return startIndex < 0 || endIndex < 0
    ? getBone(0, [0, 1, 0])
    : Object.freeze({ kind: 'chord', startIndex, endIndex })
}

const getWrist = (
  boneNames: readonly string[],
  side: MinifigSide
): MinifigWristAttachment | null => {
  const forearmIndex = findSideBone(boneNames, side, 'el')
  const wristIndex = findSideBone(boneNames, side, 'wr')
  const handIndex = findSideBone(boneNames, side, 'ha')
  return forearmIndex < 0 || wristIndex < 0 || handIndex < 0
    ? null
    : Object.freeze({ forearmIndex, wristIndex, handIndex })
}

// The skeleton of the race driver and the figure builder's drivers: pelvis, torso, two arms, a dummy that carries the hat and head, a head.
const getSeatedRig = (): MinifigRig =>
  Object.freeze({
    posture: MinifigPosture.SEATED,
    hipsHeight: SEATED_HIPS_HEIGHT,
    pelvisIndex: 0,
    torsoIndex: 1,
    headIndex: 4,
    limbs: Object.freeze({
      legs: Object.freeze({
        left: getBone(0, SEATED_LEG_DIRECTION),
        right: getBone(0, SEATED_LEG_DIRECTION),
      }),
      arms: Object.freeze({
        left: getBone(2, SEATED_ARM_DIRECTION),
        right: getBone(3, SEATED_ARM_DIRECTION),
      }),
    }),
    wrists: null,
  })

// The bone the waist hangs from carries the figure (the menus' root; a cinema's figure may hang below a dummy that walks it about).
const getPelvisIndex = (boneNames: readonly string[], parentIndices: readonly (number | null)[]) =>
  Math.max(parentIndices[findBone(boneNames, /^wais/)] ?? 0, 0)

// The head's bone: the menus' `head-rr`; a cinema's figure names it after what it wears (`cr_hat`, `helmetvv`, `mh_hair1`), the
// first bone below the dummy on the neck.
const getHeadIndex = (boneNames: readonly string[], parentIndices: readonly (number | null)[]) => {
  const named = findBone(boneNames, /^head/)
  if (named >= 0) return named
  const neckIndex = findBone(boneNames, /^neck/)
  const dummyIndex = parentIndices.findIndex(
    (parent, index) => parent === neckIndex && /^dumm/.test(boneNames[index] ?? '')
  )
  return dummyIndex < 0 ? -1 : parentIndices.indexOf(dummyIndex)
}

// The skeleton of the menus' figures (`rr`, `hr`, `rp`, `hp`: thigh, knee, ankle, foot and toe chains, waist, chest, neck, head, and a
// shoulder, elbow, wrist and hand for each arm), whose bind pose has the arms out sideways; the cinemas' figures have the same bones
// under names of their own (`ches1360`, `l_thghbr`, `l_wrstvv`, `l_ha1358`).
const getStandingRig = (
  boneNames: readonly string[],
  parentIndices: readonly (number | null)[]
): MinifigRig => {
  const leftWrist = getWrist(boneNames, 'left')
  const rightWrist = getWrist(boneNames, 'right')
  return Object.freeze({
    posture: MinifigPosture.STANDING,
    hipsHeight: STANDING_HIPS_HEIGHT,
    pelvisIndex: getPelvisIndex(boneNames, parentIndices),
    torsoIndex: Math.max(findBone(boneNames, /^ches/), 0),
    headIndex: Math.max(getHeadIndex(boneNames, parentIndices), 0),
    limbs: Object.freeze({
      legs: Object.freeze({
        left: getChord(boneNames, 'left', 'th', 'an'),
        right: getChord(boneNames, 'right', 'th', 'an'),
      }),
      arms: Object.freeze({
        left: getChord(boneNames, 'left', 'sh', 'wr'),
        right: getChord(boneNames, 'right', 'sh', 'wr'),
      }),
    }),
    wrists:
      leftWrist === null || rightWrist === null
        ? null
        : Object.freeze({ left: leftWrist, right: rightWrist }),
  })
}

// How a minifigure's parts follow a driver's skeleton (its bones' names and parents): the seated or the standing one, told apart by
// their bones; null for a skeleton that is neither.
export const getMinifigRig = (
  boneNames: readonly string[],
  parentIndices: readonly (number | null)[]
): MinifigRig | null => {
  if (boneNames.length === SEATED_BONE_COUNT && boneNames[1] === 'torso') return getSeatedRig()
  if (findBone(boneNames, /^ches/) >= 0 && getHeadIndex(boneNames, parentIndices) >= 0) {
    return getStandingRig(boneNames, parentIndices)
  }
  return null
}
