import {
  BinaryToken,
  createTokenReader,
  TokenReaderFailure,
  type TokenReader,
} from '../../../token-reader/index.ts'
import {
  DEFAULT_BYTE,
  DEFAULT_INTEGER,
  NAME_MAXIMUM_LENGTH,
  SkyKeyword,
} from '../../types/sky-keyword/sky-keyword.ts'
import type { ByteTriple, Sky, SkyKeyframe, SkySetting } from '../../types/sky.types.ts'

const DEFAULT_TRIPLE: ByteTriple = Object.freeze([
  DEFAULT_BYTE,
  DEFAULT_BYTE,
  DEFAULT_BYTE,
] as const)

const readByteTriple = (reader: TokenReader): ByteTriple => {
  const first = reader.readInteger() & 0xff
  const second = reader.readInteger() & 0xff
  const third = reader.readInteger() & 0xff
  return Object.freeze([first, second, third] as const)
}

// `[ count ]` with the bracket helpers 0x0044e8c0 and 0x0044e8e0, without the curly.
const readBracketedCount = (reader: TokenReader): number => {
  reader.expectLeftBracket()
  const count = reader.readInteger() >>> 0
  reader.expectRightBracket()
  return count
}

const readKeyframe = (reader: TokenReader): SkyKeyframe => {
  reader.expectToken(SkyKeyword.SETTING)
  reader.expectLeftCurly()
  let keyframe: SkyKeyframe = {
    integer: DEFAULT_INTEGER,
    firstBytes: DEFAULT_TRIPLE,
    secondBytes: DEFAULT_TRIPLE,
    thirdBytes: DEFAULT_TRIPLE,
  }
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.RIGHT_CURLY;
    keyword = reader.getNextToken()
  ) {
    switch (keyword) {
      case SkyKeyword.INTEGER:
        keyframe = { ...keyframe, integer: reader.readInteger() }
        break
      case SkyKeyword.FIRST_BYTES:
        keyframe = { ...keyframe, firstBytes: readByteTriple(reader) }
        break
      case SkyKeyword.SECOND_BYTES:
        keyframe = { ...keyframe, secondBytes: readByteTriple(reader) }
        break
      case SkyKeyword.THIRD_BYTES:
        keyframe = { ...keyframe, thirdBytes: readByteTriple(reader) }
        break
      default:
        reader.fail(TokenReaderFailure.SYNTAX_ERROR)
    }
  }
  return Object.freeze(keyframe)
}

const readSetting = (reader: TokenReader): SkySetting => {
  reader.expectToken(SkyKeyword.SETTING)
  const keyframeCount = readBracketedCount(reader)
  const name = reader.readStringWithMaximumLength(NAME_MAXIMUM_LENGTH)
  reader.expectLeftCurly()
  const keyframes = Array.from({ length: keyframeCount }, () => readKeyframe(reader))
  reader.expectRightCurly()
  return Object.freeze({ name, keyframes: Object.freeze(keyframes) })
}

// LEGORacers.exe 0x0041c550: `0x2c [ count ] { (0x27 [ keys ] "name" { (0x27 { ... }) * keys }) * count }`,
// then one token that may be 0x2d "name" and one more that may be 0x2e float; other tokens there are dropped.
export const parseSky = (bytes: Uint8Array): Sky => {
  const reader = createTokenReader(bytes)
  reader.expectToken(SkyKeyword.SETTINGS)
  const settingCount = readBracketedCount(reader)
  reader.expectLeftCurly()
  const settings = Array.from({ length: settingCount }, () => readSetting(reader))
  reader.expectRightCurly()
  const selectedSettingName =
    reader.getNextToken() === SkyKeyword.SELECTED_SETTING
      ? reader.readStringWithMaximumLength(NAME_MAXIMUM_LENGTH)
      : null
  const float = reader.getNextToken() === SkyKeyword.FLOAT ? reader.readFloat() : null
  return Object.freeze({
    settings: Object.freeze(settings),
    selectedSettingName,
    float,
    readByteCount: reader.getPosition(),
  })
}
