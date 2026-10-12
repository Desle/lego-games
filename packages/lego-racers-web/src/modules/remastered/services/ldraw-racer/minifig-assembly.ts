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

// The library's parts of a driver put together as a minifigure in the posture of the skeleton's bind pose: hips and legs (the sitting
// legs are the standing ones turned forward about the hips, as the library's own sitting assembly does it), the torso, arms and hands
// (the hook for the left hand of a hook torso), the head and its hat. Everything is in the figure's own frame: LDraw axes, the hips'
// origin, y down.
export const createMinifigPartPlans = (
  spec: MinifigSpec,
  posture: MinifigPosture
): readonly MinifigPartPlan[] => {
  const { surfaces } = spec
  const leg = getLegMatrix(posture)
  const head = getTranslation(0, HEAD_Y, 0)
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
    plan(MinifigPartKey.HIPS, '3815b', getDirectColor(surfaces.hipsColor), new Matrix4()),
    plan(MinifigPartKey.LEFT_LEG, '3817b', getDirectColor(surfaces.legsColor), leg),
    spec.isPegLegs
      ? plan(MinifigPartKey.RIGHT_LEG, '2532', 6, leg)
      : plan(MinifigPartKey.RIGHT_LEG, '3816b', getDirectColor(surfaces.legsColor), leg),
    plan(
      MinifigPartKey.TORSO,
      '973',
      getDirectColor(surfaces.torsoColor),
      getTranslation(0, TORSO_Y, 0)
    ),
    plan(MinifigPartKey.HEAD, '3626b', getDirectColor(surfaces.skinColor), head),
    ...(spec.hat === null
      ? []
      : [plan(MinifigPartKey.HEAD, spec.hat.part, spec.hat.colorCode, head)]),
    ...sides.flatMap(({ side, arm, key, handKey }) => {
      const armMatrix = getArmMatrix(side, posture)
      const isHook = spec.isHookTorso && side === 'left'
      return [
        plan(key, arm, getDirectColor(surfaces.armColor), armMatrix),
        plan(
          handKey,
          isHook ? '2531' : '3820',
          isHook ? 8 : getDirectColor(surfaces.skinColor),
          armMatrix.clone().multiply(getHandInArmFrame(side))
        ),
      ]
    }),
  ])
}
