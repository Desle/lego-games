import {
  BinaryToken,
  createTokenReader,
  TokenReaderFailure,
  type TokenReader,
} from '../../../token-reader/index.ts'
import { DEFAULT_IDENTIFIER, TimerKeyword } from '../../types/timer-keyword/timer-keyword.ts'
import type { MarkableValue, Timer, TimerList } from '../../types/timer.types.ts'

// After 0x28 or 0x29 the next token is either 0x2b and an integer, or a value whose integer is kept.
const readMarkableValue = (reader: TokenReader): MarkableValue => {
  if (reader.getNextToken() === TimerKeyword.MARKED) {
    return Object.freeze({ value: reader.readInteger(), isMarked: true })
  }
  return Object.freeze({ value: reader.getIntegerValue(), isMarked: false })
}

const readTimer = (reader: TokenReader): Timer => {
  reader.expectToken(TimerKeyword.TIMER)
  reader.expectToken(BinaryToken.LEFT_CURLY)
  let timer: Timer = {
    firstValue: 0,
    isFirstValueMarked: false,
    secondValue: 0,
    isSecondValueRandomised: false,
    thirdValue: 0,
    identifier: DEFAULT_IDENTIFIER,
  }
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.RIGHT_CURLY;
    keyword = reader.getNextToken()
  ) {
    switch (keyword) {
      case TimerKeyword.FIRST_VALUE: {
        const { value, isMarked } = readMarkableValue(reader)
        timer = {
          ...timer,
          firstValue: value,
          isFirstValueMarked: timer.isFirstValueMarked || isMarked,
        }
        break
      }
      case TimerKeyword.SECOND_VALUE: {
        const { value, isMarked } = readMarkableValue(reader)
        timer = {
          ...timer,
          secondValue: value,
          isSecondValueRandomised: timer.isSecondValueRandomised || isMarked,
        }
        break
      }
      case TimerKeyword.IDENTIFIER:
        timer = { ...timer, identifier: reader.readInteger() }
        break
      case TimerKeyword.THIRD_VALUE:
        timer = { ...timer, thirdValue: reader.readInteger() }
        break
      default:
        reader.fail(TokenReaderFailure.SYNTAX_ERROR)
    }
  }
  return Object.freeze(timer)
}

// LEGORacers.exe 0x00464aa0: `0x27 [ count`, then for a non-zero count `] { (0x27 { ... }) * count`; the
// closing brackets of an empty list and the final curly are never read.
export const parseTimers = (bytes: Uint8Array): TimerList => {
  const reader = createTokenReader(bytes)
  reader.expectToken(TimerKeyword.TIMER)
  reader.expectToken(BinaryToken.LEFT_BRACKET)
  const count = reader.readInteger() >>> 0
  if (count === 0)
    return Object.freeze({ timers: Object.freeze([]), readByteCount: reader.getPosition() })
  reader.expectToken(BinaryToken.RIGHT_BRACKET)
  reader.expectToken(BinaryToken.LEFT_CURLY)
  const timers = Array.from({ length: count }, () => readTimer(reader))
  return Object.freeze({ timers: Object.freeze(timers), readByteCount: reader.getPosition() })
}
