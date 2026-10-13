import type { Box3, Group } from 'three'
import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'

// What the layer draws in place of an effect's model: a power-up object's file, nothing (the inside of a model a file draws whole),
// or the part that stands in for a pickup brick.
export const EffectModelDrawingSourceKind = createEnum({
  FILE: 'file',
  NOTHING: 'nothing',
  PICKUP_PART: 'pickup_part',
})
export type EffectModelDrawingSourceKind = EnumValues<typeof EffectModelDrawingSourceKind>

export type EffectModelDrawingSource = {
  readonly kind: EffectModelDrawingSourceKind
  // The models folder's file (`powerups/<MODEL>.ldr`) of a FILE source; null for the others.
  readonly file: string | null
}

// A power-up object's file, read and prepared (plain studs) once for every drawing of it, with its bounds (LDraw units and axes).
export type PreparedPowerUpObject = {
  readonly text: string
  readonly model: Group
  readonly bounds: Box3
}
