import type { EnumValues } from '../../../../shared/types/enum.types.ts'
import type { SaveFileFailure as SaveFileFailureValues } from './save-errors.ts'

export type SaveFileFailure = EnumValues<typeof SaveFileFailureValues>
