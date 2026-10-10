import { BinaryToken, createTokenReader, type TokenReader } from '../../../token-reader/index.ts'
import {
  IMAGE_NAME_MAXIMUM_LENGTH,
  LoadScreenKeyword,
} from '../../types/load-screen-keyword/load-screen-keyword.ts'
import type { LoadScreen, ScreenPoint } from '../../types/load-screen.types.ts'

const readPoints = (reader: TokenReader): readonly ScreenPoint[] => {
  const count = reader.readArrayCount() >>> 0
  const points = Array.from({ length: count }, () => {
    const x = reader.readFloat()
    const y = reader.readFloat()
    return Object.freeze([x, y] as const)
  })
  reader.expectRightCurly()
  return Object.freeze(points)
}

// LEGORacers.exe 0x0042f480: `0x27 { keywords }`; unknown keywords are skipped and nothing after `}` is read.
export const parseLoadScreen = (bytes: Uint8Array): LoadScreen => {
  const reader = createTokenReader(bytes)
  reader.expectToken(LoadScreenKeyword.LOAD_SCREEN)
  reader.expectLeftCurly()
  let imageName: string | null = null
  let points: readonly ScreenPoint[] = Object.freeze([])
  let stringIndex = 0
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.RIGHT_CURLY;
    keyword = reader.getNextToken()
  ) {
    if (keyword === LoadScreenKeyword.IMAGE_NAME) {
      imageName = reader.readStringWithMaximumLength(IMAGE_NAME_MAXIMUM_LENGTH)
    } else if (keyword === LoadScreenKeyword.POINTS) {
      points = readPoints(reader)
    } else if (keyword === LoadScreenKeyword.STRING_INDEX) {
      stringIndex = reader.readInteger()
    }
  }
  return Object.freeze({ imageName, points, stringIndex, readByteCount: reader.getPosition() })
}
