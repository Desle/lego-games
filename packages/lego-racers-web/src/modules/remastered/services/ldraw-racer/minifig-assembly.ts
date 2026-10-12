import { Matrix4 } from 'three'
import { MinifigPartKey, MinifigPosture } from './minifig-assembly.types.ts'
import type { MinifigPartPlan } from './minifig-assembly.types.ts'
import type { MinifigSpec } from './minifig-spec.types.ts'

const DIRECT_COLOR_PREFIX = '0x2'
const STANDING_ARM_ANGLE = Math.PI / 2
// The race driver's arms (`arm_l`, `arm_r`) reach forward and 14 degrees below the horizontal: the principal axis of their vertices.
const SEATED_ARM_ANGLE = -(Math.PI / 2 - (14 * Math.PI) / 180)
const ARM_PIVOT_X = 15.552
const TORSO_Y = -24
const SHOULDER_Y = TORSO_Y + 9
const HEAD_Y = -48
const LEG_Y = 12

// A colour of the original (0xRRGGBB) as the library takes a direct colour.
export const getDirectColor = (color: number): string =>
  `${DIRECT_COLOR_PREFIX}${color.toString(16).padStart(6, '0').toUpperCase()}`

const getTranslation = (x: number, y: number, z: number): Matrix4 =>
  new Matrix4().makeTranslation(x, y, z)

// The torso with arms and hands (973c01) puts each hand at a place and an angle that goes with an arm tilted 9.78 degrees; the hand's
// place in its arm's own frame is what moves with the arm whatever the arm does.
const HAND_IN_TORSO_FRAME = Object.freeze({
  left: new Matrix4().set(
    0.985,
    0.1202,
    -0.1202,
    23.6904,
    -0.17,
    0.6964,
    -0.6964,
    26.774,
    0,
    0.707,
    0.707,
    -9.8982,
    0,
    0,
    0,
    1
  ),
  right: new Matrix4().set(
    0.985,
    -0.1202,
    0.1202,
    -23.6904,
    0.17,
    0.6964,
    -0.6964,
    26.774,
    0,
    0.707,
    0.707,
    -9.8982,
    0,
    0,
    0,
    1
  ),
})
const TILTED_ARM_ANGLE = (9.78 * Math.PI) / 180

const getHandInArmFrame = (side: 'left' | 'right'): Matrix4 => {
  const sign = side === 'left' ? 1 : -1
  const tiltedArm = getTranslation(sign * ARM_PIVOT_X, 9, 0).multiply(
    new Matrix4().makeRotationZ(sign * -TILTED_ARM_ANGLE)
  )
  return tiltedArm.invert().multiply(HAND_IN_TORSO_FRAME[side])
}

const getArmMatrix = (side: 'left' | 'right', posture: MinifigPosture): Matrix4 => {
  const sign = side === 'left' ? 1 : -1
  const swing =
    posture === MinifigPosture.STANDING
      ? new Matrix4().makeRotationZ(-sign * STANDING_ARM_ANGLE)
      : new Matrix4().makeRotationX(SEATED_ARM_ANGLE)
  return getTranslation(sign * ARM_PIVOT_X, SHOULDER_Y, 0).multiply(swing)
}

const getLegMatrix = (posture: MinifigPosture): Matrix4 =>
  posture === MinifigPosture.STANDING
    ? getTranslation(0, LEG_Y, 0)
    : getTranslation(0, LEG_Y, 0).multiply(
        new Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1)
      )

const PLAIN_HEAD = '3626b'
const PLAIN_TORSO = '973'
const HOOK_COLOR = 8

// The library's parts of a driver put together as a minifigure in the posture of the skeleton's bind pose: hips and legs (the sitting
// legs are the standing ones turned forward about the hips, as the library's own sitting assembly does it), the torso, arms and hands
// (the hook for the left hand of a hook torso), the head and its hats. A part the spec has a library print for is that print in the
// library's colour; the rest is the plain part in the colour of the game's picture. Everything is in the figure's own frame: LDraw axes,
// the hips' origin, y down.
export const createMinifigPartPlans = (
  spec: MinifigSpec,
  posture: MinifigPosture
): readonly MinifigPartPlan[] => {
  const { surfaces, torso, face, legs } = spec
  const leg = getLegMatrix(posture)
  const head = getTranslation(0, HEAD_Y, 0)
  const skinColor = getDirectColor(surfaces.skinColor)
  const legsColor = getDirectColor(surfaces.legsColor)
  const armColor = torso === null ? getDirectColor(surfaces.armColor) : torso.armColorCode
  const handColor = torso === null ? skinColor : torso.handColorCode
  const plan = (
    key: MinifigPartKey,
    part: string,
    color: number | string,
    matrix: Matrix4
  ): MinifigPartPlan => Object.freeze({ key, part, color, matrix })
  const sides = [
    { side: 'left', arm: '3819', key: MinifigPartKey.LEFT_ARM, handKey: MinifigPartKey.LEFT_HAND },
    {
      side: 'right',
      arm: '3818',
      key: MinifigPartKey.RIGHT_ARM,
      handKey: MinifigPartKey.RIGHT_HAND,
    },
  ] as const
  return Object.freeze([
    plan(
      MinifigPartKey.HIPS,
      '3815b',
      legs === null ? getDirectColor(surfaces.hipsColor) : legs.hipsColorCode,
      new Matrix4()
    ),
    plan(
      MinifigPartKey.LEFT_LEG,
      legs?.leftLeg.part ?? '3817b',
      legs?.leftLeg.colorCode ?? legsColor,
      leg
    ),
    plan(
      MinifigPartKey.RIGHT_LEG,
      legs?.rightLeg.part ?? '3816b',
      legs?.rightLeg.colorCode ?? legsColor,
      leg
    ),
    plan(
      MinifigPartKey.TORSO,
      torso?.part ?? PLAIN_TORSO,
      torso === null ? getDirectColor(surfaces.torsoColor) : torso.torsoColorCode,
      getTranslation(0, TORSO_Y, 0)
    ),
    face === null
      ? plan(MinifigPartKey.HEAD, PLAIN_HEAD, skinColor, head)
      : plan(MinifigPartKey.HEAD, face.part, face.colorCode, head),
    ...spec.hats.map((hat) => plan(MinifigPartKey.HEAD, hat.part, hat.colorCode, head)),
    ...sides.flatMap(({ side, arm, key, handKey }) => {
      const armMatrix = getArmMatrix(side, posture)
      const isHook = spec.isHookTorso && side === 'left'
      return [
        plan(key, arm, armColor, armMatrix),
        plan(
          handKey,
          isHook ? '2531' : '3820',
          isHook ? HOOK_COLOR : handColor,
          armMatrix.clone().multiply(getHandInArmFrame(side))
        ),
      ]
    }),
  ])
}
