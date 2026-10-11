import type { EnumValues } from '../../../../shared/types/enum.types.ts'
import type { SaveProfile } from '../save-data.types.ts'
import type { BestTimeKind as BestTimeKindValues } from './progression-flags.ts'

export type BestTimeKind = EnumValues<typeof BestTimeKindValues>

export type GhostBeatenUpdate = {
  readonly profile: SaveProfile
  readonly isNewlyBeaten: boolean
  readonly isFinalGhostBeaten: boolean
}

export type BestTimeUpdate = {
  readonly profile: SaveProfile
  readonly isRecorded: boolean
}
