import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'

// What a part of a minifigure is: a piece of the figure, or what is worn on its head (a hat, and a second piece of headgear on it).
export const MinifigRole = createEnum({
  HIPS: 'hips',
  LEFT_LEG: 'left-leg',
  RIGHT_LEG: 'right-leg',
  TORSO: 'torso',
  HEAD: 'head',
  HAT: 'hat',
  ACCESSORY: 'accessory',
  LEFT_ARM: 'left-arm',
  RIGHT_ARM: 'right-arm',
  LEFT_HAND: 'left-hand',
  RIGHT_HAND: 'right-hand',
})
export type MinifigRole = EnumValues<typeof MinifigRole>

// What role recognition reads of a part: its file name and where it sits in the assembled figure (LDraw axes, the top of the hips).
export type MinifigPartPlacement = {
  readonly partName: string
  readonly position: readonly [number, number, number]
}

export type MinifigPartWithRole<Part extends MinifigPartPlacement> = {
  readonly role: MinifigRole
  readonly part: Part
}
