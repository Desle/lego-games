import { BinaryToken, createTokenReader, TokenReaderFailure } from '../../../token-reader/index.ts'
import type { TokenReader } from '../../../token-reader/index.ts'
import { getUnsignedByte } from '../../../../shared/binary-values/binary-values.ts'
import { createNameTable } from '../../../../shared/name-table/name-table.ts'
import type { NameTable } from '../../../../shared/name-table/name-table.types.ts'
import {
  IMAGE_KEYWORD_2B_EXTRA_FLAG,
  IMAGE_KEYWORD_2B_FLAG,
  IMAGE_NAME_LENGTH,
  ImageDatabaseKeyword,
} from '../../types/image-database-keyword/image-database-keyword.ts'
import type {
  ImageByteTriple,
  ImageDatabase,
  ImageDefinition,
} from '../../types/image-database.types.ts'

const readByteTriple = (reader: TokenReader): ImageByteTriple => {
  const first = getUnsignedByte(reader.readInteger())
  const second = getUnsignedByte(reader.readInteger())
  const third = getUnsignedByte(reader.readInteger())
  return Object.freeze([first, second, third] as const)
}

// 0x100231bb..0x1002331a: `0x27 "name" { keyword... }`.
const readImage = (reader: TokenReader, names: NameTable, index: number): ImageDefinition => {
  reader.expectToken(ImageDatabaseKeyword.IMAGE)
  const name = reader.readStringWithMaximumLength(IMAGE_NAME_LENGTH)
  names.add(name, index)
  reader.expectLeftCurly()

  let flags = 0
  let keyword2bBytes: ImageByteTriple = Object.freeze([0, 0, 0] as const)
  let keyword2cBytes: ImageByteTriple = Object.freeze([0xff, 0xff, 0xff] as const)
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.RIGHT_CURLY;
    keyword = reader.getNextToken()
  ) {
    switch (keyword) {
      case ImageDatabaseKeyword.FLAG_0X4:
        flags |= 0x4
        break
      case ImageDatabaseKeyword.FLAG_0X8:
        flags = (flags & 0xffef) | 0x8
        break
      case ImageDatabaseKeyword.FLAG_0X10:
        flags = (flags & 0xfff7) | 0x10
        break
      case ImageDatabaseKeyword.KEYWORD_2B:
        flags |= IMAGE_KEYWORD_2B_FLAG
        keyword2bBytes = readByteTriple(reader)
        break
      case ImageDatabaseKeyword.KEYWORD_2C:
        keyword2cBytes = readByteTriple(reader)
        break
      default:
        reader.fail(TokenReaderFailure.SYNTAX_ERROR)
    }
  }

  const isKeyword2bFlagSet = (flags & IMAGE_KEYWORD_2B_FLAG) !== 0
  return Object.freeze({
    name,
    flags: isKeyword2bFlagSet ? flags | IMAGE_KEYWORD_2B_EXTRA_FLAG : flags,
    keyword2bBytes,
    keyword2cBytes,
  })
}

// GolDP.dll 0x10023060: `0x27 [ count ] { image... }`; a count of 0 stops after the `{`.
export const parseImageDatabase = (bytes: Uint8Array): ImageDatabase => {
  const reader = createTokenReader(bytes)
  reader.expectToken(ImageDatabaseKeyword.IMAGE)
  const count = reader.readArrayCount()
  const images: ImageDefinition[] = []
  if (count !== 0) {
    const names = createNameTable()
    for (let index = 0; index < count >>> 0; index++) images.push(readImage(reader, names, index))
    reader.expectRightCurly()
  }
  return Object.freeze({ images: Object.freeze(images), readByteCount: reader.getPosition() })
}
