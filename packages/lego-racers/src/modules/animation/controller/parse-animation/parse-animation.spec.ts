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
  encodeFloat,
  encodeInteger,
  encodeString,
} from '../../../../shared/token-encoding/token-encoding.ts'
import { KEYWORD_31_DEFAULT_FOURTH_VALUE } from '../../types/animation-keyword/animation-keyword.ts'
import { parseAnimation } from './parse-animation.ts'

const ORIGINAL_JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)

const integers = (...values: readonly number[]): readonly number[] => values.flatMap(encodeInteger)
const floats = (...values: readonly number[]): readonly number[] => values.flatMap(encodeFloat)

const list = (keyword: number, entries: readonly (readonly number[])[]): readonly number[] => [
  keyword,
  ...encodeArrayHeader(entries.length),
  ...entries.flat(),
  0x06,
]

const entry = (name: string, body: readonly number[]): readonly number[] => [
  0x2c,
  ...encodeString(name),
  0x05,
  ...body,
  0x06,
]

describe('parseAnimation', () => {
  it('reads the 0x27 lists, the 0x2b entries and the 0x2c entries', () => {
    // Arrange
    const bytes = new Uint8Array([
      0x27,
      0x05,
      ...list(0x28, [floats(1, 2, 3)]),
      ...list(0x29, [floats(0, 0, 0, 1)]),
      ...list(0x2a, [integers(0x1_0005)]),
      0x06,
      ...list(0x2b, [integers(1, 2, 0x1_8000, 4, 5, 6)]),
      ...list(0x2c, [
        entry('alpelvis', [
          0x2b,
          ...encodeInteger(7),
          0x2d,
          ...encodeInteger(-1),
          0x2e,
          ...encodeInteger(-1),
          0x2f,
          ...encodeInteger(30),
          0x30,
          ...floats(1, 2, 3),
          0x31,
          ...floats(4, 5, 6, 7),
        ]),
        entry('torso', []),
      ]),
    ])

    // Act
    const parsed = parseAnimation(bytes)

    // Assert
    expect(parsed).toEqual({
      keyword28Triples: [[1, 2, 3]],
      keyword29Quadruples: [[0, 0, 0, 1]],
      keyword2aValues: [5],
      keyword2bEntries: [[1, 2, -0x8000, 4, 5, 6]],
      keyword2cEntries: [
        {
          name: 'alpelvis',
          keyword2fValue: Math.fround(30 * Math.fround(0.001)),
          keyword30Values: [1, 2, 3],
          keyword31Values: [4, 5, 6, 7],
          keyword2bValue: 7,
          keyword2dValue: -1,
          keyword2eValue: 0xffff,
        },
        {
          name: 'torso',
          keyword2fValue: 0,
          keyword30Values: [0, 0, 0],
          keyword31Values: [0, 0, 0, KEYWORD_31_DEFAULT_FOURTH_VALUE],
          keyword2bValue: 0,
          keyword2dValue: 0,
          keyword2eValue: 0,
        },
      ],
      readByteCount: bytes.byteLength,
    })
  })

  it('rejects 0x2c entries with the same first eight characters', () => {
    // Arrange
    const bytes = new Uint8Array(list(0x2c, [entry('abcdefgh1', []), entry('abcdefgh2', [])]))

    // Act
    const parse = () => parseAnimation(bytes)

    // Assert
    expect(parse).toThrow(new DuplicateNameError('abcdefgh2'))
  })

  it('requires keyword 0x2c before every entry and an int after 0x2d', () => {
    // Arrange
    const missingKeyword = new Uint8Array([0x2c, ...encodeArrayHeader(1), 0x2b])
    const floatValue = new Uint8Array(list(0x2c, [entry('bone', [0x2d, ...encodeFloat(1)])]))

    // Act
    const parseMissingKeyword = () => parseAnimation(missingKeyword)
    const parseFloatValue = () => parseAnimation(floatValue)

    // Assert
    expect(parseMissingKeyword).toThrow(
      expect.objectContaining({ failure: TokenReaderFailure.EXPECTED_KEYWORD })
    )
    expect(parseFloatValue).toThrow(
      expect.objectContaining({ failure: TokenReaderFailure.EXPECTED_INTEGER })
    )
  })

  it('rejects unknown keywords and empty lists', () => {
    // Arrange
    const unknownTopLevel = new Uint8Array([0x2d])
    const unknownInBlock = new Uint8Array([0x27, 0x05, 0x2b])
    const emptyList = new Uint8Array([0x2b, ...encodeArrayHeader(0), 0x06])

    // Act
    const parses = [unknownTopLevel, unknownInBlock, emptyList].map(
      (bytes) => () => parseAnimation(bytes)
    )

    // Assert
    expect(parses[0]).toThrow(expect.objectContaining({ failure: TokenReaderFailure.SYNTAX_ERROR }))
    expect(parses[1]).toThrow(expect.objectContaining({ failure: TokenReaderFailure.SYNTAX_ERROR }))
    expect(parses[2]).toThrow(
      expect.objectContaining({ failure: TokenReaderFailure.EXPECTED_INTEGER })
    )
  })

  it('refuses a 0x2f value too large to scale exactly', () => {
    // Arrange
    const bytes = new Uint8Array(list(0x2c, [entry('bone', [0x2f, ...encodeInteger(2 ** 30)])]))

    // Act
    const parse = () => parseAnimation(bytes)

    // Assert
    expect(parse).toThrow(UnportableFileError)
  })

  it.skipIf(!existsSync(ORIGINAL_JAM_PATH))(
    'parses every animation in the original LEGO.JAM to its last byte',
    () => {
      // Arrange
      const archive = openJamArchive(new Uint8Array(readFileSync(ORIGINAL_JAM_PATH)))
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.ADB'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        return { path, byteLength: bytes.byteLength, parsed: parseAnimation(bytes) }
      })

      // Assert
      expect(results).toHaveLength(421)
      for (const { path, byteLength, parsed } of results) {
        expect({ path, readByteCount: parsed.readByteCount }).toEqual({
          path,
          readByteCount: byteLength,
        })
      }
    }
  )
})
