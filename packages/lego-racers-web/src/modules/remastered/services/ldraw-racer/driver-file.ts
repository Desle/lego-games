import { parseBuilderDocument } from '@lego-games/ldraw/building'
import type { BuilderPart } from '@lego-games/ldraw/building'
import { MinifigPartKey } from './minifig-assembly.types.ts'
import { DriverPartRole } from './driver-file.types.ts'
import type { DriverFilePart, DriverRecordKey, DriverRecordMatch } from './driver-file.types.ts'

const ROLE_PREFIX = '0 !RACERS ROLE '
const PART_BYTE_COUNT = 5
// The bytes that pick the parts (hat, face, torso, legs); the fifth, the expression, does not change what is drawn.
const PART_CHOICE_BYTE_COUNT = 4
// The neck (LDraw units, y down): a part with no role whose origin is above it is worn on the head, anything else on the torso.
const NECK_Y = -32

// The library's minifigure parts by number (older numbers too, prints and assemblies included); a sided part with no side of its own
// in its number takes the side it sits on (the figure's left is +x).
const PART_NUMBER_ROLES: readonly (readonly [RegExp, DriverPartRole | 'arm' | 'hand'])[] = [
  [/^3626/, DriverPartRole.HEAD],
  [/^(?:973|76382)/, DriverPartRole.TORSO],
  [/^(?:3815|970)/, DriverPartRole.HIPS],
  [/^(?:3817|972)/, DriverPartRole.LEFT_LEG],
  [/^(?:3816|971|2532)/, DriverPartRole.RIGHT_LEG],
  [/^(?:3818|3819|981|982)/, 'arm'],
  [/^(?:3820|983|2531)/, 'hand'],
]

const PART_KEYS: Readonly<Record<DriverPartRole, MinifigPartKey>> = Object.freeze({
  [DriverPartRole.HEAD]: MinifigPartKey.HEAD,
  [DriverPartRole.HAT]: MinifigPartKey.HEAD,
  [DriverPartRole.ACCESSORY]: MinifigPartKey.HEAD,
  [DriverPartRole.TORSO]: MinifigPartKey.TORSO,
  [DriverPartRole.LEFT_ARM]: MinifigPartKey.LEFT_ARM,
  [DriverPartRole.RIGHT_ARM]: MinifigPartKey.RIGHT_ARM,
  [DriverPartRole.LEFT_HAND]: MinifigPartKey.LEFT_HAND,
  [DriverPartRole.RIGHT_HAND]: MinifigPartKey.RIGHT_HAND,
  [DriverPartRole.HIPS]: MinifigPartKey.HIPS,
  [DriverPartRole.LEFT_LEG]: MinifigPartKey.LEFT_LEG,
  [DriverPartRole.RIGHT_LEG]: MinifigPartKey.RIGHT_LEG,
})

const getPartNumber = (partName: string): string =>
  (partName.split(/[\\/]/).pop() ?? '').toLowerCase().replace(/\.dat$/, '')

const getStatedRole = (part: BuilderPart): DriverPartRole | null => {
  const stated = part.commentLines
    .filter((line) => line.startsWith(ROLE_PREFIX))
    .map((line) => line.slice(ROLE_PREFIX.length).trim().toLowerCase())
    .at(-1)
  return Object.values(DriverPartRole).find((role) => role === stated) ?? null
}

// The role of a part the file names none for (a hand-edited file): a minifigure part by its number, anything else by where it sits.
export const getRoleByPart = (part: BuilderPart): DriverPartRole => {
  const number = getPartNumber(part.partName)
  const known = PART_NUMBER_ROLES.find(([pattern]) => pattern.test(number))?.[1]
  const isLeft = part.position[0] >= 0
  if (known === 'arm') return isLeft ? DriverPartRole.LEFT_ARM : DriverPartRole.RIGHT_ARM
  if (known === 'hand') return isLeft ? DriverPartRole.LEFT_HAND : DriverPartRole.RIGHT_HAND
  if (known !== undefined) return known
  return part.position[1] < NECK_Y ? DriverPartRole.HAT : DriverPartRole.TORSO
}

// The parts of a driver file, each with its role: the `!RACERS ROLE` line before it, else what its part number or place says.
export const parseDriverFile = (text: string): readonly DriverFilePart[] =>
  Object.freeze(
    parseBuilderDocument(text).parts.map((part) =>
      Object.freeze({ role: getStatedRole(part) ?? getRoleByPart(part), part })
    )
  )

export const getMinifigPartKey = (role: DriverPartRole): MinifigPartKey => PART_KEYS[role]

// A head or a torso of the library with no print of its own (`3626b`, `3626c`, `973`, `76382`): the game's picture goes on it.
export const getIsPlainHead = (partName: string): boolean =>
  /^3626[a-d]?$/.test(getPartNumber(partName))

export const getIsPlainTorso = (partName: string): boolean =>
  /^(?:973|76382)$/.test(getPartNumber(partName))

const getIsSameChoice = (first: readonly number[], second: readonly number[]): boolean =>
  first.length === PART_BYTE_COUNT &&
  second.length === PART_BYTE_COUNT &&
  first.slice(0, PART_CHOICE_BYTE_COUNT).every((value, index) => value === second[index])

// The driver of the database a drawing request names: by the model of its race figure, else by the parts its five bytes choose.
// Null for a figure the player built of other parts (no file is named for it).
export const findDriverRecord = (
  drivers: readonly DriverRecordKey[],
  modelName: string | null,
  partBytes: readonly number[] | null
): DriverRecordMatch | null => {
  const driver = drivers.find((candidate) =>
    modelName !== null
      ? candidate.modelName.toLowerCase() === modelName.toLowerCase()
      : partBytes !== null && getIsSameChoice(candidate.partBytes, partBytes)
  )
  return driver === undefined || driver.partBytes.length !== PART_BYTE_COUNT
    ? null
    : Object.freeze({ name: driver.name.toUpperCase(), partBytes: driver.partBytes })
}
