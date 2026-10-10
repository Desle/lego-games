import { createEnum } from '../../../../shared/types/enum.types.ts'

// The original returns 6 for NAME_TOO_LONG and 8 for NOT_FOUND (LEGORacers.exe 0x0044d900).
export const JamLookupFailure = createEnum({
  NAME_TOO_LONG: 'name_too_long',
  NOT_FOUND: 'not_found',
})
