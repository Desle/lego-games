import type { Matrix4 } from 'three'
import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'

// The pieces of a minifigure that move on their own: each follows a bone (or the chord between two) of the original's skeleton.
export const MinifigPartKey = createEnum({
  HIPS: 'hips',
  LEFT_LEG: 'left_leg',
  RIGHT_LEG: 'right_leg',
  TORSO: 'torso',
  HEAD: 'head',
  LEFT_ARM: 'left_arm',
  RIGHT_ARM: 'right_arm',
  LEFT_HAND: 'left_hand',
  RIGHT_HAND: 'right_hand',
})
export type MinifigPartKey = EnumValues<typeof MinifigPartKey>

export const MinifigPosture = createEnum({
  // Arms out sideways and legs straight down: the bind pose of the menu figure's skeleton.
  STANDING: 'standing',
  // Legs forward and arms reaching forward: the bind pose of the race driver's skeleton.
  SEATED: 'seated',
})
export type MinifigPosture = EnumValues<typeof MinifigPosture>

// One library part of the figure: where it sits in the figure's own frame (LDraw axes and units) when the skeleton is in its bind pose.
export type MinifigPartPlan = {
  readonly key: MinifigPartKey
  readonly part: string
  // An LDraw colour code, or a direct colour (`0x2RRGGBB`).
  readonly color: number | string
  readonly matrix: Matrix4
  // Flesh (a head, a hand): the part the menus' lighting must show as the yellow it is.
  readonly isSkin: boolean
}
