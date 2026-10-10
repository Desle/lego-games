import { BinaryToken, createTokenReader, TokenReaderFailure } from '../../../token-reader/index.ts'
import { readByteTriple } from '../../../token-reader/index.ts'
import type { ByteTriple, TokenReader } from '../../../token-reader/index.ts'
import { getSignedShort } from '../../../../shared/binary-values/binary-values.ts'
import {
  TEXTURE_LOADED_FLAG,
  TEXTURE_NAME_LENGTH,
  TextureDatabaseKeyword,
} from '../../types/texture-database-keyword/texture-database-keyword.ts'
import type { TextureDatabase, TextureDefinition } from '../../types/texture-database.types.ts'

// 0x1002b6e0..0x1002b81d: `0x27 "name" { keyword... }`.
const readTexture = (reader: TokenReader, knownNames: Set<string>): TextureDefinition => {
  reader.expectToken(TextureDatabaseKeyword.TEXTURE)
  const name = reader.readStringWithMaximumLength(TEXTURE_NAME_LENGTH)
  // 0x10028b90 searches the world's databases, this one included, before 0x100282c0 adds the name.
  const isNameRegistered = !knownNames.has(name)
  knownNames.add(name)
  reader.expectLeftCurly()

  let flags = 0
  let keyword29Value = 0
  let keyword2cBytes: ByteTriple = Object.freeze([0, 0, 0] as const)
  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.RIGHT_CURLY;
    keyword = reader.getNextToken()
  ) {
    switch (keyword) {
      case TextureDatabaseKeyword.FLAG_0X4:
        flags |= 0x4
        break
      case TextureDatabaseKeyword.KEYWORD_29:
        keyword29Value = getSignedShort(reader.readInteger())
        flags |= 0x1
        break
      case TextureDatabaseKeyword.FLAG_0X8:
        flags = (flags & 0xffef) | 0x8
        break
      case TextureDatabaseKeyword.FLAG_0X10:
        flags = (flags & 0xfff7) | 0x10
        break
      case TextureDatabaseKeyword.KEYWORD_2C:
        flags |= 0x20
        keyword2cBytes = readByteTriple(reader)
        break
      case TextureDatabaseKeyword.FLAG_0X100:
        flags |= 0x100
        break
      case TextureDatabaseKeyword.FLAG_0X200:
        flags |= 0x200
        break
      default:
        reader.fail(TokenReaderFailure.SYNTAX_ERROR)
    }
  }

  return Object.freeze({
    name,
    isNameRegistered,
    flags: (flags | TEXTURE_LOADED_FLAG) & 0xffff,
    keyword29Value,
    keyword2cBytes,
  })
}

// GolDP.dll 0x1002b5a0: `0x27 [ count ] { texture... }`; a count of 0 stops after the `{`.
export const parseTextureDatabase = (bytes: Uint8Array): TextureDatabase => {
  const reader = createTokenReader(bytes)
  reader.expectToken(TextureDatabaseKeyword.TEXTURE)
  const count = reader.readArrayCount()
  const textures: TextureDefinition[] = []
  if (count !== 0) {
    const knownNames = new Set<string>()
    for (let index = 0; index < count >>> 0; index++) textures.push(readTexture(reader, knownNames))
    reader.expectRightCurly()
  }
  return Object.freeze({ textures: Object.freeze(textures), readByteCount: reader.getPosition() })
}
