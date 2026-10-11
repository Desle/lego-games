import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { SaveFileFailure as SaveFileFailureValue } from './save-errors.types.ts'

export const SaveFileFailure = createEnum({
  // FUN_00442910 returns 0x11 for a block whose sum does not match, and SaveFile_Parse for a missing "LR".
  CORRUPT_BLOCK: 'corrupt_block',
  BAD_SIGNATURE: 'bad_signature',
  // The stream ran out before the last block (the file layer's own error code).
  TRUNCATED: 'truncated',
})

export class SaveFileError extends Error {
  readonly failure: SaveFileFailureValue

  constructor(failure: SaveFileFailureValue, detail: string) {
    super(`Invalid save file (${failure}): ${detail}`)
    this.name = 'SaveFileError'
    this.failure = failure
  }
}
