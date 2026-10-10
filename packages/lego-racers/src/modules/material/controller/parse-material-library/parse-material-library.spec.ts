import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { TokenReaderError, TokenReaderFailure } from '../../../token-reader/index.ts'
import { DuplicateMaterialNameError } from '../../types/material-errors/material-errors.ts'
import { DEFAULT_MATERIAL_FLAGS } from '../../types/material-keyword/material-keyword.ts'
import { parseMaterialLibrary } from './parse-material-library.ts'

const ORIGINAL_JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)

const encodeString = (value: string): readonly number[] => [
  0x02,
  ...Array.from({ length: value.length }, (_, index) => value.charCodeAt(index)),
  0x00,
]

const byteInteger = (value: number): readonly number[] => [0x0c, value]

const materialBlock = (name: string, body: readonly number[]): readonly number[] => [
  0x27,
  ...encodeString(name),
  0x05,
  ...body,
  0x06,
]

const library = (blocks: readonly (readonly number[])[]): Uint8Array =>
  new Uint8Array([0x27, 0x07, ...byteInteger(blocks.length), 0x08, 0x05, ...blocks.flat(), 0x06])

describe('parseMaterialLibrary', () => {
  it('starts every material from the default definition', () => {
    // Arrange
    const bytes = library([materialBlock('plain', [])])

    // Act
    const parsed = parseMaterialLibrary(bytes)

    // Assert
    expect(parsed).toEqual({
      materials: [
        {
          name: 'plain',
          flags: DEFAULT_MATERIAL_FLAGS,
          textureName: null,
          ambientColor: [255, 255, 255, 255],
          diffuseColor: [255, 255, 255, 255],
          alphaFunction: 2,
          alphaReference: 0,
          sourceBlend: 1,
          destinationBlendOrOpacity: 0,
        },
      ],
      readByteCount: bytes.byteLength,
    })
  })

  it('applies colors, texture, flags, alpha test and blending', () => {
    // Arrange
    const body = [
      0x28,
      ...[1, 2, 3, 4].flatMap(byteInteger),
      0x29,
      ...[5, 6, 7, 8].flatMap(byteInteger),
      0x2c,
      ...encodeString('streak'),
      0x2a,
      0x2d,
      0x2f,
      0x33,
      ...byteInteger(0x80),
      0x38,
      0x3a,
      0x41,
      0x49,
    ]
    const bytes = library([materialBlock('streak', body)])

    // Act
    const [material] = parseMaterialLibrary(bytes).materials

    // Assert
    expect(material).toEqual({
      name: 'streak',
      flags:
        (((((DEFAULT_MATERIAL_FLAGS & ~0x4) | 0x2 | 0x8) & ~0x10) | 0x20) &
          ~0x80 &
          ~0x1200 &
          ~0x8000) |
        0x40 |
        0x2100 |
        0x10000,
      textureName: 'streak',
      ambientColor: [1, 2, 3, 4],
      diffuseColor: [5, 6, 7, 8],
      alphaFunction: 3,
      alphaReference: 0x80,
      sourceBlend: 1,
      destinationBlendOrOpacity: 8,
    })
  })

  it('reads an opacity into the destination blend byte', () => {
    // Arrange
    const bytes = library([materialBlock('glass', [0x4e, ...byteInteger(0x60)])])

    // Act
    const [material] = parseMaterialLibrary(bytes).materials

    // Assert
    expect(material?.destinationBlendOrOpacity).toBe(0x60)
    expect(material?.flags).toBe(((DEFAULT_MATERIAL_FLAGS & ~0x2100) | 0x1200) >>> 0)
  })

  it('keeps reading a reference after a non-function token when the function needs one', () => {
    // Arrange
    const bytes = library([materialBlock('odd', [0x2f, 0x2a, ...byteInteger(9)])])

    // Act
    const [material] = parseMaterialLibrary(bytes).materials

    // Assert
    expect([material?.alphaFunction, material?.alphaReference]).toEqual([2, 9])
  })

  it('rejects a name longer than eight characters as an invalid string', () => {
    // Arrange
    const bytes = library([materialBlock('ninechars', [])])

    // Act
    const parse = () => parseMaterialLibrary(bytes)

    // Assert
    expect(parse).toThrow(TokenReaderError)
    expect(parse).toThrow('Invalid string')
  })

  it('rejects a second material with the same name', () => {
    // Arrange
    const bytes = library([materialBlock('twin', []), materialBlock('twin', [])])

    // Act
    const parse = () => parseMaterialLibrary(bytes)

    // Assert
    expect(parse).toThrow(new DuplicateMaterialNameError('twin'))
  })

  it('rejects a blend factor outside 0x39..0x43 as an expected keyword', () => {
    // Arrange
    const bytes = library([materialBlock('bad', [0x38, 0x39, 0x44])])

    // Act
    const parse = () => parseMaterialLibrary(bytes)

    // Assert
    expect(parse).toThrow(expect.objectContaining({ failure: TokenReaderFailure.EXPECTED_KEYWORD }))
  })

  it('rejects an unknown keyword inside a material as a syntax error', () => {
    // Arrange
    const bytes = library([materialBlock('bad', [0x30])])

    // Act
    const parse = () => parseMaterialLibrary(bytes)

    // Assert
    expect(parse).toThrow('Syntax error')
  })

  it.skipIf(!existsSync(ORIGINAL_JAM_PATH))(
    'parses every material library in the original LEGO.JAM to its last byte',
    () => {
      // Arrange
      const archive = openJamArchive(new Uint8Array(readFileSync(ORIGINAL_JAM_PATH)))
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.MDB'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        return { path, byteLength: bytes.byteLength, library: parseMaterialLibrary(bytes) }
      })

      // Assert
      expect(results).toHaveLength(208)
      for (const { path, byteLength, library: parsed } of results) {
        expect({ path, readByteCount: parsed.readByteCount }).toEqual({
          path,
          readByteCount: byteLength,
        })
      }
    }
  )
})
