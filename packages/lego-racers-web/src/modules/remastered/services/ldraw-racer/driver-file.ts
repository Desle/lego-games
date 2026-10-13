import { parseBuilderDocument } from '@lego-games/ldraw/building'
import type { BuilderPart } from '@lego-games/ldraw/building'
import { findMinifigRole, getMinifigRoles } from '@lego-games/ldraw/minifig'
import type { MinifigRole } from '@lego-games/ldraw/minifig'
import type { DriverFilePart, DriverRecordKey, DriverRecordMatch } from './driver-file.types.ts'

const ROLE_PREFIX = '0 !RACERS ROLE '
const PART_BYTE_COUNT = 5
// The bytes that pick the parts (hat, face, torso, legs); the fifth, the expression, does not change what is drawn.
const PART_CHOICE_BYTE_COUNT = 4

const getPartNumber = (partName: string): string =>
  (partName.split(/[\\/]/).pop() ?? '').toLowerCase().replace(/\.dat$/, '')

const getStatedRole = (part: BuilderPart): MinifigRole | null => {
  const stated = part.commentLines
    .filter((line) => line.startsWith(ROLE_PREFIX))
    .map((line) => line.slice(ROLE_PREFIX.length))
    .at(-1)
  return stated === undefined ? null : findMinifigRole(stated)
}

// The parts of a driver file, each with its role: the `!RACERS ROLE` line before it, else what its part number or place says.
export const parseDriverFile = (text: string): readonly DriverFilePart[] => {
  const { parts } = parseBuilderDocument(text)
  const statedRoles = new Map(
    parts.flatMap((part, index) => {
      const role = getStatedRole(part)
      return role === null ? [] : [[index, role] as const]
    })
  )
  return getMinifigRoles(parts, statedRoles)
}

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
