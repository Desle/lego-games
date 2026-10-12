import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'

export const ShadowMode = createEnum({
  CLASSIC: 'classic',
  REAL: 'real',
  SCENERY: 'scenery',
})
export type ShadowMode = EnumValues<typeof ShadowMode>
