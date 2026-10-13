import { LDRAW_BRICK_COLORS } from '../ldraw-car/ldraw-brick-colors.ts'
import { formatPartLine } from '../ldraw-builder/builder-document.ts'
import {
  LDRAW_FACES,
  LDRAW_HATS,
  LDRAW_LEGS,
  LDRAW_TORSOS,
} from '../ldraw-racer/ldraw-minifig-parts.ts'
import { MinifigPartConfidence } from '../ldraw-racer/ldraw-minifig-parts.types.ts'
import { createMinifigPartPlans } from '../ldraw-racer/minifig-assembly.ts'
import { MinifigPartKey } from '../ldraw-racer/minifig-assembly.types.ts'
import type { MinifigPartPlan } from '../ldraw-racer/minifig-assembly.types.ts'
import type { MinifigSpec } from '../ldraw-racer/minifig-spec.types.ts'
import { DriverPartRole } from './driver-export.types.ts'
import type { DriverExportPart } from './driver-export.types.ts'

const DIRECT_COLOR_PREFIX = '0x2'
const HEXADECIMAL = 16
const BYTE = 255
const GREY_SATURATION = 0.22
const BLACK_VALUE = 0.3
const HAT_BYTE = 0
const FACE_BYTE = 1
const TORSO_BYTE = 2
const LEGS_BYTE = 3

const KEY_ROLES: Readonly<Record<MinifigPartKey, DriverPartRole>> = Object.freeze({
  [MinifigPartKey.HIPS]: DriverPartRole.HIPS,
  [MinifigPartKey.LEFT_LEG]: DriverPartRole.LEFT_LEG,
  [MinifigPartKey.RIGHT_LEG]: DriverPartRole.RIGHT_LEG,
  [MinifigPartKey.TORSO]: DriverPartRole.TORSO,
  [MinifigPartKey.HEAD]: DriverPartRole.HEAD,
  [MinifigPartKey.LEFT_ARM]: DriverPartRole.LEFT_ARM,
  [MinifigPartKey.RIGHT_ARM]: DriverPartRole.RIGHT_ARM,
  [MinifigPartKey.LEFT_HAND]: DriverPartRole.LEFT_HAND,
  [MinifigPartKey.RIGHT_HAND]: DriverPartRole.RIGHT_HAND,
})

const getChannelDistance = (first: number, second: number): number =>
  [0, 8, 16].reduce((sum, shift) => {
    const gap = ((first >> shift) & BYTE) - ((second >> shift) & BYTE)
    return sum + gap * gap
  }, 0)

const getChannels = (color: number): readonly number[] =>
  [16, 8, 0].map((shift) => ((color >> shift) & BYTE) / BYTE)

const getValue = (color: number): number => Math.max(...getChannels(color))

const getIsGrey = (color: number): boolean => {
  const value = getValue(color)
  const saturation = value === 0 ? 0 : (value - Math.min(...getChannels(color))) / value
  return saturation < GREY_SATURATION || value < BLACK_VALUE
}

// The builder edits only parts in a colour code, so a colour of the game's pictures becomes the nearest of the game's brick colours:
// a grey or a near black by its lightness (by distance alone a dark grey would come out brown), a colour among the colours.
export const getNearestBrickColorCode = (color: number): number => {
  const isGrey = getIsGrey(color)
  const getDistance = (candidate: number) =>
    isGrey ? Math.abs(getValue(candidate) - getValue(color)) : getChannelDistance(candidate, color)
  return (
    LDRAW_BRICK_COLORS.filter((candidate) => getIsGrey(candidate.hex) === isGrey).sort(
      (first, second) => getDistance(first.hex) - getDistance(second.hex)
    )[0]?.code ?? 0
  )
}

const getPictureColor = (color: number | string): number | null =>
  typeof color === 'string' && color.startsWith(DIRECT_COLOR_PREFIX)
    ? parseInt(color.slice(DIRECT_COLOR_PREFIX.length), HEXADECIMAL)
    : null

const getConfidence = (spec: MinifigSpec, role: DriverPartRole): MinifigPartConfidence => {
  const byte = (index: number) => spec.partBytes[index] ?? 0
  const confidence =
    role === DriverPartRole.HAT || role === DriverPartRole.ACCESSORY
      ? LDRAW_HATS[byte(HAT_BYTE)]?.confidence
      : role === DriverPartRole.HEAD
        ? LDRAW_FACES[byte(FACE_BYTE)]?.confidence
        : role === DriverPartRole.HIPS ||
            role === DriverPartRole.LEFT_LEG ||
            role === DriverPartRole.RIGHT_LEG
          ? LDRAW_LEGS[byte(LEGS_BYTE)]?.confidence
          : LDRAW_TORSOS[byte(TORSO_BYTE)]?.confidence
  return confidence ?? MinifigPartConfidence.GUESS
}

// The head plan is the flesh one; the hats follow it on the same bone, the first is the hat and the rest sit on it.
const getRoles = (plans: readonly MinifigPartPlan[]): readonly DriverPartRole[] => {
  const hatPlans = plans.filter((plan) => plan.key === MinifigPartKey.HEAD && !plan.isSkin)
  return plans.map((plan) => {
    if (plan.key !== MinifigPartKey.HEAD || plan.isSkin) return KEY_ROLES[plan.key]
    return hatPlans[0] === plan ? DriverPartRole.HAT : DriverPartRole.ACCESSORY
  })
}

// The parts the HD layer draws a driver of this spec with, in the standing rest pose of `minifig-geometry` (arms down).
export const getDriverExportParts = (spec: MinifigSpec): readonly DriverExportPart[] => {
  const plans = createMinifigPartPlans(spec)
  const roles = getRoles(plans)
  return Object.freeze(
    plans.map((plan, index) => {
      const role = roles[index] ?? KEY_ROLES[plan.key]
      const pictureColor = getPictureColor(plan.color)
      const elements = plan.matrix.elements
      const element = (position: number) => elements[position] ?? 0
      return Object.freeze({
        role,
        confidence: getConfidence(spec, role),
        partName: `${plan.part}.dat`,
        colorCode:
          pictureColor === null ? Number(plan.color) : getNearestBrickColorCode(pictureColor),
        pictureColor,
        position: [element(12), element(13), element(14)] as const,
        rotation: Object.freeze([0, 4, 8, 1, 5, 9, 2, 6, 10].map(element)),
      })
    })
  )
}

const getHexText = (color: number): string =>
  `#${color.toString(HEXADECIMAL).padStart(6, '0').toUpperCase()}`

const getPartLines = (part: DriverExportPart): readonly string[] => [
  `0 // ${part.role}`,
  `0 !RACERS ROLE ${part.role}`,
  `0 !RACERS GUESS ${part.confidence}`,
  ...(part.pictureColor === null
    ? []
    : [
        `0 // the game paints it ${getHexText(part.pictureColor)}; this is the nearest brick colour`,
      ]),
  formatPartLine(part),
]

// A driver as a plain LDraw model: the header the builder keeps, notes on the frame, then each part after its role and the guess's confidence.
export const getDriverLDrawText = (driverName: string, spec: MinifigSpec): string =>
  [
    `0 ${driverName} driver`,
    `0 Name: ${driverName}.ldr`,
    '0 Author: Claude for desle',
    '0 !LDRAW_ORG Unofficial_Model',
    '0 BFC CERTIFY CCW',
    '0 Exported from the HD layer guess (ldraw-minifig-parts.ts, minifig-assembly.ts); edit freely, it is never overwritten',
    '0 Origin: the top of the hips (3815b own origin), LDraw axes and units, y down, the figure faces -z',
    '0 Pose: standing rest pose, arms down; the legs turn about the hip axle at y 12, the head about the neck at y -32',
    '0 Faces and torso fronts without a library print are drawn from the game textures at draw time; this file stores plain parts',
    '',
    ...getDriverExportParts(spec).flatMap(getPartLines),
    '',
  ].join('\n')
