import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'
import type { MinifigPartConfidence } from '../ldraw-racer/ldraw-minifig-parts.types.ts'

// What a part of an exported driver is, written as `0 !RACERS ROLE <role>` before it so the posing code can find the bone it follows.
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

// One part line of an exported driver: the library part, its LDraw colour code, and its placement in the figure's frame.
export type DriverExportPart = {
  readonly role: DriverPartRole
  readonly confidence: MinifigPartConfidence
  readonly partName: string
  readonly colorCode: number
  // The game's picture colour (0xRRGGBB) a plain part was given the nearest brick colour of, or null for the library's own colour.
  readonly pictureColor: number | null
  readonly position: readonly [number, number, number]
  readonly rotation: readonly number[]
}

export type DriverExportOutcome = {
  readonly fileName: string
  readonly partCount: number
  readonly isWritten: boolean
}
