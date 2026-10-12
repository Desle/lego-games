import { Matrix4 } from 'three'
import { MinifigPartKey } from './minifig-assembly.types.ts'
import { MINIFIG_GEOMETRY } from './minifig-geometry.ts'
import type { MinifigPartPlan } from './minifig-assembly.types.ts'
import type { MinifigSpec } from './minifig-spec.types.ts'

const DIRECT_COLOR_PREFIX = '0x2'
const PLAIN_HEAD = '3626b'
const PLAIN_TORSO = '973'
const HOOK_COLOR = 8

// A colour of the original (0xRRGGBB) as the library takes a direct colour.
export const getDirectColor = (color: number): string =>
  `${DIRECT_COLOR_PREFIX}${color.toString(16).padStart(6, '0').toUpperCase()}`

// The library's parts of a driver put together as the library assembles a standing minifigure (`minifig-geometry`): hips and legs, the
// torso, arms hanging and hands (the hook for the left hand of a hook torso), the head and its hats. A part the spec has a library print
// for is that print in the library's colour; the rest is the plain part in the colour of the game's picture. Everything is in the
// figure's own frame: LDraw axes, the hips' origin, y down. The joints turn the parts into the skeleton's pose.
export const createMinifigPartPlans = (spec: MinifigSpec): readonly MinifigPartPlan[] => {
  const { surfaces, torso, face, legs } = spec
  const leg = MINIFIG_GEOMETRY.legs
  const head = MINIFIG_GEOMETRY.head
  const skinColor = getDirectColor(surfaces.skinColor)
  const legsColor = getDirectColor(surfaces.legsColor)
  const armColor = torso === null ? getDirectColor(surfaces.armColor) : torso.armColorCode
  const handColor = torso === null ? skinColor : torso.handColorCode
  const plan = (
    key: MinifigPartKey,
    part: string,
    color: number | string,
    matrix: Matrix4,
    isSkin = false
  ): MinifigPartPlan => Object.freeze({ key, part, color, matrix, isSkin })
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
      MINIFIG_GEOMETRY.torso
    ),
    face === null
      ? plan(MinifigPartKey.HEAD, PLAIN_HEAD, skinColor, head, true)
      : plan(MinifigPartKey.HEAD, face.part, face.colorCode, head, true),
    ...spec.hats.map((hat) => plan(MinifigPartKey.HEAD, hat.part, hat.colorCode, head)),
    ...sides.flatMap(({ side, arm, key, handKey }) => {
      const isHook = spec.isHookTorso && side === 'left'
      return [
        plan(key, arm, armColor, MINIFIG_GEOMETRY.arms[side]),
        plan(
          handKey,
          isHook ? '2531' : '3820',
          isHook ? HOOK_COLOR : handColor,
          MINIFIG_GEOMETRY.hands[side],
          !isHook
        ),
      ]
    }),
  ])
}
