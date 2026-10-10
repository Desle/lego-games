import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { TokenReaderFailure } from '../../../token-reader/index.ts'
import {
  encodeArrayHeader,
  encodeInteger,
  encodeString,
} from '../../../../shared/token-encoding/token-encoding.ts'
import { parseTextureDatabase } from './parse-texture-database.ts'

const ORIGINAL_JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)

const textureBlock = (name: string, body: readonly number[]): readonly number[] => [
  0x27,
  ...encodeString(name),
  0x05,
  ...body,
  0x06,
]

const database = (blocks: readonly (readonly number[])[]): Uint8Array =>
  new Uint8Array([0x27, ...encodeArrayHeader(blocks.length), ...blocks.flat(), 0x06])

describe('parseTextureDatabase', () => {
  it('starts every texture from zero flags, value and bytes, and adds flag 0x800', () => {
    // Arrange
    const bytes = database([textureBlock('plain', [])])

    // Act
    const parsed = parseTextureDatabase(bytes)

    // Assert
    expect(parsed).toEqual({
      textures: [
        {
          name: 'plain',
          isNameRegistered: true,
          flags: 0x800,
          keyword29Value: 0,
          keyword2cBytes: [0, 0, 0],
        },
      ],
      readByteCount: bytes.byteLength,
    })
  })

  it('applies every keyword in file order', () => {
    // Arrange
    const body = [
      0x28,
      0x29,
      ...encodeInteger(0x1_8000),
      0x2a,
      0x2b,
      0x2c,
      ...encodeInteger(1),
      ...encodeInteger(2),
      ...encodeInteger(0x103),
      0x2d,
      0x2e,
    ]
    const bytes = database([textureBlock('carshad0', body)])

    // Act
    const [texture] = parseTextureDatabase(bytes).textures

    // Assert
    expect(texture).toEqual({
      name: 'carshad0',
      isNameRegistered: true,
      flags: 0x4 | 0x1 | 0x10 | 0x20 | 0x100 | 0x200 | 0x800,
      keyword29Value: -0x8000,
      keyword2cBytes: [1, 2, 3],
    })
  })

  it('keeps a repeated name unregistered instead of failing', () => {
    // Arrange
    const bytes = database([textureBlock('twin', []), textureBlock('twin', [])])

    // Act
    const parsed = parseTextureDatabase(bytes)

    // Assert
    expect(parsed.textures.map((texture) => texture.isNameRegistered)).toEqual([true, false])
  })

  it('stops after the opening curly when the count is zero', () => {
    // Arrange
    const bytes = new Uint8Array([0x27, ...encodeArrayHeader(0), 0x06])

    // Act
    const parsed = parseTextureDatabase(bytes)

    // Assert
    expect(parsed).toEqual({ textures: [], readByteCount: bytes.byteLength - 1 })
  })

  it('rejects an unknown keyword as a syntax error', () => {
    // Arrange
    const bytes = database([textureBlock('bad', [0x2f])])

    // Act
    const parse = () => parseTextureDatabase(bytes)

    // Assert
    expect(parse).toThrow(expect.objectContaining({ failure: TokenReaderFailure.SYNTAX_ERROR }))
  })

  it.skipIf(!existsSync(ORIGINAL_JAM_PATH))(
    'parses every texture database in the original LEGO.JAM to its last byte',
    () => {
      // Arrange
      const archive = openJamArchive(new Uint8Array(readFileSync(ORIGINAL_JAM_PATH)))
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.TDB'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        const parsed = parseTextureDatabase(bytes)
        return { path, parsed, unreadBytes: [...bytes.subarray(parsed.readByteCount)] }
      })

      // Assert
      expect(results).toHaveLength(162)
      for (const { path, parsed, unreadBytes } of results) {
        // An empty database stops after its `{`; only the closing `}` stays unread.
        const expectedUnreadBytes = parsed.textures.length === 0 ? [0x06] : []
        expect({ path, unreadBytes }).toEqual({ path, unreadBytes: expectedUnreadBytes })
      }
      expect(results.filter(({ parsed }) => parsed.textures.length === 0)).toHaveLength(1)
    }
  )
})
