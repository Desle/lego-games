import {
  BinaryToken,
  createTokenReader,
  TokenReaderFailure,
  type TokenReader,
} from '../../../token-reader/index.ts'
import { DuplicateMaterialNameError } from '../../types/material-errors/material-errors.ts'
import {
  AlphaFunctionKeyword,
  BlendFactorKeyword,
  DEFAULT_ALPHA_FUNCTION,
  DEFAULT_MATERIAL_FLAGS,
  DEFAULT_SOURCE_BLEND,
  MATERIAL_NAME_LENGTH,
  MaterialKeyword,
} from '../../types/material-keyword/material-keyword.ts'
import type { Material, MaterialColor, MaterialLibrary } from '../../types/material.types.ts'

const OPAQUE_WHITE: MaterialColor = Object.freeze([0xff, 0xff, 0xff, 0xff] as const)

const readColor = (reader: TokenReader): MaterialColor => {
  const first = reader.readInteger() & 0xff
  const second = reader.readInteger() & 0xff
  const third = reader.readInteger() & 0xff
  const fourth = reader.readInteger() & 0xff
  return Object.freeze([first, second, third, fourth] as const)
}

const replaceFlags = (flags: number, cleared: number, set: number): number =>
  ((flags & ~cleared) | set) >>> 0

const readBlendFactor = (reader: TokenReader): number => {
  const keyword = reader.getNextToken()
  if (keyword < BlendFactorKeyword.FIRST || keyword > BlendFactorKeyword.LAST) {
    reader.fail(TokenReaderFailure.EXPECTED_KEYWORD)
  }
  return keyword - BlendFactorKeyword.FIRST
}

const getIsAlphaFunctionWithoutReference = (alphaFunction: number): boolean =>
  alphaFunction === AlphaFunctionKeyword.ALWAYS - AlphaFunctionKeyword.FIRST ||
  alphaFunction === AlphaFunctionKeyword.NEVER - AlphaFunctionKeyword.FIRST

// 0x100263b4..0x10026822: one `0x27 "name" { ... }` block.
const readMaterial = (reader: TokenReader, knownNames: Set<string>): Material => {
  reader.expectToken(MaterialKeyword.MATERIAL)
  const name = reader.readStringWithMaximumLength(MATERIAL_NAME_LENGTH)
  if (knownNames.has(name)) throw new DuplicateMaterialNameError(name)
  knownNames.add(name)
  reader.expectLeftCurly()

  let flags = DEFAULT_MATERIAL_FLAGS
  let textureName: string | null = null
  let ambientColor = OPAQUE_WHITE
  let diffuseColor = OPAQUE_WHITE
  let alphaFunction = DEFAULT_ALPHA_FUNCTION
  let alphaReference = 0
  let sourceBlend = DEFAULT_SOURCE_BLEND
  let destinationBlendOrOpacity = 0

  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.RIGHT_CURLY;
    keyword = reader.getNextToken()
  ) {
    switch (keyword) {
      case MaterialKeyword.AMBIENT_COLOR:
        ambientColor = readColor(reader)
        break
      case MaterialKeyword.DIFFUSE_COLOR:
        diffuseColor = readColor(reader)
        break
      case MaterialKeyword.FLAT_SHADING:
        flags = replaceFlags(flags, 0x4, 0x2)
        break
      case MaterialKeyword.GOURAUD_SHADING:
        flags = replaceFlags(flags, 0x2, 0x4)
        break
      case MaterialKeyword.TEXTURE:
        textureName = reader.readStringWithMaximumLength(MATERIAL_NAME_LENGTH)
        flags = replaceFlags(flags, 0, 0x8)
        break
      case MaterialKeyword.MODULATE_TEXTURE:
        flags = replaceFlags(flags, 0x10, 0x20)
        break
      case MaterialKeyword.DECAL_TEXTURE:
        flags = replaceFlags(flags, 0x20, 0x10)
        break
      case MaterialKeyword.ALPHA_TEST: {
        flags = replaceFlags(flags, 0x80, 0x40)
        const functionKeyword = reader.getNextToken()
        const isFunctionKeyword =
          functionKeyword >= AlphaFunctionKeyword.FIRST &&
          functionKeyword <= AlphaFunctionKeyword.LAST
        // 0x10026676: any other token is dropped and the current function keeps its reference.
        if (isFunctionKeyword) alphaFunction = functionKeyword - AlphaFunctionKeyword.FIRST
        if (!getIsAlphaFunctionWithoutReference(alphaFunction)) {
          alphaReference = reader.readInteger() & 0xff
        }
        break
      }
      case MaterialKeyword.BLEND:
        flags = replaceFlags(flags, 0x1200, 0x2100)
        sourceBlend = readBlendFactor(reader)
        destinationBlendOrOpacity = readBlendFactor(reader)
        break
      case MaterialKeyword.LINEAR_FILTERING:
        flags = replaceFlags(flags, 0x800, 0x400)
        break
      case MaterialKeyword.POINT_FILTERING:
        flags = replaceFlags(flags, 0x400, 0x800)
        break
      case MaterialKeyword.FLAG_0X4000:
        flags = replaceFlags(flags, 0, 0x4000)
        break
      case MaterialKeyword.WRAP_TEXTURE:
        flags = replaceFlags(flags, 0x10000, 0x8000)
        break
      case MaterialKeyword.CLAMP_TEXTURE:
        flags = replaceFlags(flags, 0x8000, 0x10000)
        break
      case MaterialKeyword.FLAG_0X20000:
        flags = replaceFlags(flags, 0, 0x20000)
        break
      case MaterialKeyword.FLAG_0X80000:
        flags = replaceFlags(flags, 0x100000, 0x80000)
        break
      case MaterialKeyword.FLAG_0X200000:
        flags = replaceFlags(flags, 0x400000, 0x200000)
        break
      case MaterialKeyword.OPACITY:
      case MaterialKeyword.SECOND_OPACITY:
      case MaterialKeyword.THIRD_OPACITY:
      case MaterialKeyword.FOURTH_OPACITY:
      case MaterialKeyword.FIFTH_OPACITY:
        destinationBlendOrOpacity = reader.readInteger() & 0xff
        flags = replaceFlags(flags, 0x2100, 0x1200)
        break
      default:
        reader.fail(TokenReaderFailure.SYNTAX_ERROR)
    }
  }

  return Object.freeze({
    name,
    flags,
    textureName,
    ambientColor,
    diffuseColor,
    alphaFunction,
    alphaReference,
    sourceBlend,
    destinationBlendOrOpacity,
  })
}

// GolDP.dll 0x10026270: `0x27 [ count ] { material... }`; nothing after the closing curly is read.
export const parseMaterialLibrary = (bytes: Uint8Array): MaterialLibrary => {
  const reader = createTokenReader(bytes)
  reader.expectToken(MaterialKeyword.MATERIAL)
  const count = reader.readArrayCount()
  if (count === 0) reader.fail(TokenReaderFailure.EXPECTED_INTEGER)
  const knownNames = new Set<string>()
  const materials: Material[] = []
  for (let index = 0; index < count >>> 0; index++) materials.push(readMaterial(reader, knownNames))
  reader.expectRightCurly()
  return Object.freeze({ materials: Object.freeze(materials), readByteCount: reader.getPosition() })
}
