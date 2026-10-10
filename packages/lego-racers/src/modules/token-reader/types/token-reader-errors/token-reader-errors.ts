import { TOKEN_READER_FAILURE_MESSAGES } from '../token-reader-failure/token-reader-failure.ts'
import type { TokenReaderFailure } from '../token-reader/token-reader.types.ts'

export class TokenReaderError extends Error {
  readonly failure: TokenReaderFailure
  readonly position: number

  constructor(failure: TokenReaderFailure, position: number) {
    super(`${TOKEN_READER_FAILURE_MESSAGES[failure]} (at byte ${String(position)})`)
    this.name = 'TokenReaderError'
    this.failure = failure
    this.position = position
  }
}

// The original writes outside its fixed macro table here; the port refuses instead.
export class TokenReaderOverflowError extends Error {
  constructor(position: number) {
    super(`Macro table overflow (at byte ${String(position)})`)
    this.name = 'TokenReaderOverflowError'
  }
}
