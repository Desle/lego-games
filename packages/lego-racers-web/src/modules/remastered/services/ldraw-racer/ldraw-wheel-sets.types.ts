import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'

// The kinds of wheel the original's chassis models have, by what the wheel is (not only how big).
export const WheelKind = createEnum({
  WOODEN_SPOKED: 'wooden_spoked',
  SLICK: 'slick',
  OFFROAD: 'offroad',
  SPOKED_OFFROAD: 'spoked_offroad',
  DRUM: 'drum',
})
export type WheelKind = EnumValues<typeof WheelKind>

export type LDrawWheelSet = {
  readonly kind: WheelKind
  // The rubber tyre, null for a wheel that is one part (a wooden wheel).
  readonly tyrePart: string | null
  readonly rimPart: string
  // The tyre's outer diameter (the wheel's, without a tyre) in LDraw units.
  readonly diameter: number
  // The wheel's width along its axle in LDraw units.
  readonly width: number
  // The LDraw colour of the rim when the part has one colour whatever the original paints it (wood), null to take the hub's.
  readonly rimColorCode: number | null
}
