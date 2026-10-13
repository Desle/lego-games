import type { Matrix4 } from 'three'
import type { BuilderPart } from '@lego-games/ldraw/building'
import { MINIFIG_GEOMETRY, MinifigRole } from '@lego-games/ldraw/minifig'
import { LDRAW_FACES, LDRAW_HATS, LDRAW_LEGS, LDRAW_TORSOS } from './driver-catalogue-mappings.ts'
import type { DriverFilePart } from './driver-file.types.ts'

const HOOK = '2531'
const HOOK_COLOR = 8
const PLAIN_HAND = '3820'
const HIPS = '3815b'
const LEFT_ARM = '3819'
const RIGHT_ARM = '3818'
const IDENTITY: readonly number[] = Object.freeze([1, 0, 0, 0, 1, 0, 0, 0, 1])
// A three.js matrix's elements (columns first) in the order of an LDraw line's rotation rows.
const ROTATION_ELEMENTS: readonly number[] = Object.freeze([0, 4, 8, 1, 5, 9, 2, 6, 10])

const getPart = (
  role: MinifigRole,
  partName: string,
  colorCode: number,
  placement: Matrix4 | null
): DriverFilePart => {
  const elements = placement?.elements
  const part: BuilderPart = Object.freeze({
    colorCode,
    position: [elements?.[12] ?? 0, elements?.[13] ?? 0, elements?.[14] ?? 0] as const,
    rotation:
      elements === undefined
        ? IDENTITY
        : Object.freeze(ROTATION_ELEMENTS.map((index) => elements[index] ?? 0)),
    partName: `${partName}.dat`,
    commentLines: Object.freeze([]),
  })
  return Object.freeze({ role, part })
}

// A driver of the figure builder as the parts of a driver file: each catalogue piece his part bytes (hat, face, torso, legs) choose
// is the library part `driver-catalogue-mappings` names for it, assembled in the standing rest pose of `minifig-geometry` about the top of
// the hips, so a built driver is drawn by the same path as a file. Null when a byte names a piece with no mapping.
export const getCatalogueDriverParts = (
  partBytes: readonly number[]
): readonly DriverFilePart[] | null => {
  const hat = LDRAW_HATS[partBytes[0] ?? -1]
  const face = LDRAW_FACES[partBytes[1] ?? -1]
  const torso = LDRAW_TORSOS[partBytes[2] ?? -1]
  const legs = LDRAW_LEGS[partBytes[3] ?? -1]
  if (hat === undefined || face === undefined || torso === undefined || legs === undefined) {
    return null
  }
  const head = MINIFIG_GEOMETRY.head
  return Object.freeze([
    getPart(MinifigRole.HIPS, HIPS, legs.hipsColorCode, null),
    getPart(MinifigRole.LEFT_LEG, legs.leftLeg.part, legs.leftLeg.colorCode, MINIFIG_GEOMETRY.legs),
    getPart(
      MinifigRole.RIGHT_LEG,
      legs.rightLeg.part,
      legs.rightLeg.colorCode,
      MINIFIG_GEOMETRY.legs
    ),
    getPart(MinifigRole.TORSO, torso.part, torso.torsoColorCode, MINIFIG_GEOMETRY.torso),
    getPart(MinifigRole.HEAD, face.part, face.colorCode, head),
    ...hat.hats.map((piece, index) =>
      getPart(
        index === 0 ? MinifigRole.HAT : MinifigRole.ACCESSORY,
        piece.part,
        piece.colorCode,
        head
      )
    ),
    getPart(MinifigRole.LEFT_ARM, LEFT_ARM, torso.armColorCodes.left, MINIFIG_GEOMETRY.arms.left),
    getPart(
      MinifigRole.LEFT_HAND,
      torso.isHookHand ? HOOK : PLAIN_HAND,
      torso.isHookHand ? HOOK_COLOR : torso.handColorCode,
      MINIFIG_GEOMETRY.hands.left
    ),
    getPart(
      MinifigRole.RIGHT_ARM,
      RIGHT_ARM,
      torso.armColorCodes.right,
      MINIFIG_GEOMETRY.arms.right
    ),
    getPart(MinifigRole.RIGHT_HAND, PLAIN_HAND, torso.handColorCode, MINIFIG_GEOMETRY.hands.right),
  ])
}
