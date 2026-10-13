import type { BuilderPart } from '@lego-games/ldraw/building'
import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'

// What a part of a driver file is, written as `0 !RACERS ROLE <role>` before it: the bone of the game's skeleton it follows.
export const DriverPartRole = createEnum({
  HEAD: 'head',
  HAT: 'hat',
  TORSO: 'torso',
  LEFT_ARM: 'left-arm',
  RIGHT_ARM: 'right-arm',
  LEFT_HAND: 'left-hand',
  RIGHT_HAND: 'right-hand',
  HIPS: 'hips',
  LEFT_LEG: 'left-leg',
  RIGHT_LEG: 'right-leg',
  // A second piece of headgear on the hat (a visor, a plume): it follows the head.
  ACCESSORY: 'accessory',
})
export type DriverPartRole = EnumValues<typeof DriverPartRole>

// One part of a driver file and the role it plays, placed in the figure's frame (LDraw axes, the top of the hips, standing rest pose).
export type DriverFilePart = {
  readonly role: DriverPartRole
  readonly part: BuilderPart
}

// The driver database's record a request names: the file's name (the record's name, upper case) and the five part bytes.
export type DriverRecordMatch = {
  readonly name: string
  readonly partBytes: readonly number[]
}

// What a driver of the database is known by: its block name, the model of its race figure and its part bytes.
export type DriverRecordKey = {
  readonly name: string
  readonly modelName: string
  readonly partBytes: readonly number[]
}
