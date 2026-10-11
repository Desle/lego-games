import { BinaryToken } from '../binary-token/binary-token.ts'
import { TokenReaderFailure } from '../token-reader-failure/token-reader-failure.ts'
import type { TokenReader } from '../token-reader/token-reader.types.ts'

// Reads keywords up to the right curly, handing each to `applyKeyword`, which returns the new value or null for a
// keyword the original's reader does not know (its default case is a syntax error).
export const readKeywordsUntilRightCurly = <Value>(
  reader: TokenReader,
  initial: Value,
  applyKeyword: (keyword: number, value: Value) => Value | null
): Value => {
  let value = initial
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.RIGHT_CURLY;
    keyword = reader.getNextToken()
  ) {
    value = applyKeyword(keyword, value) ?? reader.fail(TokenReaderFailure.SYNTAX_ERROR)
  }
  return value
}
