import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { TokenReaderFailure } from '../../../token-reader/index.ts'
import {
  DuplicateNameError,
  UnportableFileError,
} from '../../../../shared/errors/gol-file-errors.ts'
import {
  encodeArrayHeader,
  encodeInteger,
  encodeString,
} from '../../../../shared/token-encoding/token-encoding.ts'
import { parseFontDatabase } from './parse-font-database.ts'

const ORIGINAL_JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)

const fontBlock = (name: string, body: readonly number[]): readonly number[] => [
  0x27,
  ...encodeString(name),
  0x05,
  ...body,
  0x06,
]

const database = (blocks: readonly (readonly number[])[]): Uint8Array =>
  new Uint8Array([0x27, ...encodeArrayHeader(blocks.length), ...blocks.flat(), 0x06])

const triple = (first: number, second: number, third: number): readonly number[] => [
  ...encodeInteger(first),
  ...encodeInteger(second),
  ...encodeInteger(third),
]

describe('parseFontDatabase', () => {
  it('starts every font from zero flags, no characters and default byte triples', () => {
    // Arrange
    const bytes = database([fontBlock('ignum', [])])

    // Act
    const parsed = parseFontDatabase(bytes)

    // Assert
    expect(parsed).toEqual({
      fonts: [
        {
          name: 'ignum',
          flags: 0,
          keyword2aBytes: [0, 0, 0],
          characters: null,
          keyword2cValue: null,
          keyword2dBytes: [255, 255, 255],
        },
      ],
      readByteCount: bytes.byteLength,
    })
  })

  it('reads flags, byte triples, a value and a character list', () => {
    // Arrange
    const body = [
      0x29,
      0x28,
      0x2a,
      ...triple(1, 2, 3),
      0x2c,
      ...encodeInteger(-1),
      0x2d,
      ...triple(7, 8, 9),
      0x2b,
      0x07,
      ...encodeString('E'),
      ...encodeString(''),
      ...encodeString('Ç'),
      ...encodeInteger(0xffff),
      0x08,
    ]
    const bytes = database([fontBlock('font_ths', body)])

    // Act
    const [font] = parseFontDatabase(bytes).fonts

    // Assert
    expect(font).toEqual({
      name: 'font_ths',
      flags: 0x8 | 0x20 | 0x800,
      keyword2aBytes: [1, 2, 3],
      characters: [0x45, 0, 0xc7, 0xffff],
      keyword2cValue: -1,
      keyword2dBytes: [7, 8, 9],
    })
  })

  it('rejects a character string longer than one character or an out-of-range code', () => {
    // Arrange
    const longString = database([fontBlock('bad', [0x2b, 0x07, ...encodeString('ab'), 0x08])])
    const largeCode = database([fontBlock('bad', [0x2b, 0x07, ...encodeInteger(0x10000), 0x08])])

    // Act
    const parseLongString = () => parseFontDatabase(longString)
    const parseLargeCode = () => parseFontDatabase(largeCode)

    // Assert
    expect(parseLongString).toThrow(
      expect.objectContaining({ failure: TokenReaderFailure.SYNTAX_ERROR })
    )
    expect(parseLargeCode).toThrow(
      expect.objectContaining({ failure: TokenReaderFailure.SYNTAX_ERROR })
    )
  })

  it('requires a left bracket before the characters', () => {
    // Arrange
    const bytes = database([fontBlock('bad', [0x2b, 0x05])])

    // Act
    const parse = () => parseFontDatabase(bytes)

    // Assert
    expect(parse).toThrow(
      expect.objectContaining({ failure: TokenReaderFailure.EXPECTED_LEFT_BRACKET })
    )
  })

  it('refuses more characters than the loader stack buffer holds', () => {
    // Arrange
    const characters = Array.from({ length: 101 }, () => encodeString('A')).flat()
    const bytes = database([fontBlock('big', [0x2b, 0x07, ...characters, 0x08])])

    // Act
    const parse = () => parseFontDatabase(bytes)

    // Assert
    expect(parse).toThrow(UnportableFileError)
  })

  it('rejects a second font with the same name', () => {
    // Arrange
    const bytes = database([fontBlock('twin', []), fontBlock('twin', [])])

    // Act
    const parse = () => parseFontDatabase(bytes)

    // Assert
    expect(parse).toThrow(new DuplicateNameError('twin'))
  })

  it.skipIf(!existsSync(ORIGINAL_JAM_PATH))(
    'parses every font database in the original LEGO.JAM to its last byte',
    () => {
      // Arrange
      const archive = openJamArchive(new Uint8Array(readFileSync(ORIGINAL_JAM_PATH)))
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.FDB'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        const parsed = parseFontDatabase(bytes)
        return { path, parsed, unreadBytes: [...bytes.subarray(parsed.readByteCount)] }
      })

      // Assert
      expect(results).toHaveLength(20)
      for (const { path, parsed, unreadBytes } of results) {
        // An empty database stops after its `{`; only the closing `}` stays unread.
        const expectedUnreadBytes = parsed.fonts.length === 0 ? [0x06] : []
        expect({ path, unreadBytes }).toEqual({ path, unreadBytes: expectedUnreadBytes })
      }
    }
  )
})
