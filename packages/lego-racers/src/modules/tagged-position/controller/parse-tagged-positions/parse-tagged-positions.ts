import {
  BinaryToken,
  createTokenReader,
  TokenReaderFailure,
  type TokenReader,
} from '../../../token-reader/index.ts'
import {
  DEFAULT_IDENTIFIER,
  TaggedPositionKeyword,
} from '../../types/tagged-position-keyword/tagged-position-keyword.ts'
import type {
  TaggedPosition,
  TaggedPositionList,
  Vector3,
} from '../../types/tagged-position.types.ts'

const ORIGIN: Vector3 = Object.freeze([0, 0, 0] as const)

const readTaggedPosition = (reader: TokenReader, isMirrored: boolean): TaggedPosition => {
  reader.expectToken(TaggedPositionKeyword.TAGGED_POSITION)
  reader.expectLeftCurly()
  let position = ORIGIN
  let identifier = DEFAULT_IDENTIFIER
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.RIGHT_CURLY;
    keyword = reader.getNextToken()
  ) {
    switch (keyword) {
      case TaggedPositionKeyword.POSITION: {
        const x = reader.readFloat()
        const y = reader.readFloat()
        const z = reader.readFloat()
        position = Object.freeze([x, isMirrored ? -y : y, z] as const)
        break
      }
      case TaggedPositionKeyword.IDENTIFIER:
        identifier = reader.readInteger()
        break
      default:
        reader.fail(TokenReaderFailure.SYNTAX_ERROR)
    }
  }
  return Object.freeze({ position, identifier })
}

// LEGORacers.exe 0x0045c3d0: `0x27 [ count ]`, and when count is not 0, `{ (0x27 { ... }) * count }`.
export const parseTaggedPositions = (
  bytes: Uint8Array,
  isMirrored: boolean
): TaggedPositionList => {
  const reader = createTokenReader(bytes)
  reader.expectToken(TaggedPositionKeyword.TAGGED_POSITION)
  const count = reader.readArrayCount() >>> 0
  const taggedPositions = Array.from({ length: count }, () =>
    readTaggedPosition(reader, isMirrored)
  )
  if (count !== 0) reader.expectRightCurly()
  return Object.freeze({
    taggedPositions: Object.freeze(taggedPositions),
    readByteCount: reader.getPosition(),
  })
}
