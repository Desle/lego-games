import type { EnumValues } from '../../../../shared/types/enum.types.ts'
import type { TokenReaderFailure as TokenReaderFailureEnum } from '../token-reader-failure/token-reader-failure.ts'

export type TokenReaderFailure = EnumValues<typeof TokenReaderFailureEnum>

export type TokenReader = {
  readonly getNextToken: () => number
  readonly pushBackToken: () => void
  readonly getIntegerValue: () => number
  readonly getFloatValue: () => number
  readonly getStringValue: () => string
  readonly getPosition: () => number
  readonly fail: (failure: TokenReaderFailure) => never
  readonly expectToken: (token: number) => void
  readonly readInteger: () => number
  readonly readFloat: () => number
  readonly readString: () => string
  readonly readStringWithMaximumLength: (maximumLength: number) => string
  readonly expectLeftCurly: () => void
  readonly expectRightCurly: () => void
  readonly expectLeftBracket: () => void
  readonly expectRightBracket: () => void
  readonly readArrayCount: () => number
}
