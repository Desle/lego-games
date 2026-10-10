import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { TokenReaderFailure } from '../../../token-reader/index.ts'
import {
  encodeArrayHeader,
  encodeInteger,
  encodeString,
} from '../../../../shared/token-encoding/token-encoding.ts'
import { parseMaterialAnimation } from './parse-material-animation.ts'

const ORIGINAL_JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)

const integers = (...values: readonly number[]): readonly number[] => values.flatMap(encodeInteger)

const materialsSection = (names: readonly string[]): readonly number[] => [
  0x27,
  ...encodeArrayHeader(names.length),
  ...names.flatMap((name, index) => [...encodeString(name), ...encodeInteger(index * 8)]),
  0x06,
]

const entriesSection = (bodies: readonly (readonly number[])[]): readonly number[] => [
  0x28,
  ...encodeArrayHeader(bodies.length),
  ...bodies.flatMap((body) => [0x28, 0x05, ...body, 0x06]),
  0x06,
]

const thousandth = (value: number) => Math.fround(value * Math.fround(0.001))

describe('parseMaterialAnimation', () => {
  it('reads the materials and the entries with their defaults', () => {
    // Arrange
    const bytes = new Uint8Array([
      ...materialsSection(['smoke1', 'smoke2']),
      ...entriesSection([
        [0x27, ...integers(4, 0x1_0004), 0x29, ...integers(32), 0x2a, ...integers(60)],
        [],
      ]),
    ])

    // Act
    const parsed = parseMaterialAnimation(bytes)

    // Assert
    expect(parsed).toEqual({
      materials: [
        { materialName: 'smoke1', value: 0 },
        { materialName: 'smoke2', value: 8 },
      ],
      entries: [
        { keyword27Values: [4, 4], keyword29Value: 32, keyword2aValue: thousandth(60) },
        { keyword27Values: [0, 1], keyword29Value: 1, keyword2aValue: thousandth(30) },
      ],
      readByteCount: bytes.byteLength,
    })
  })

  it('reports a missing entry keyword or curly as an expected left curly', () => {
    // Arrange
    const missingKeyword = new Uint8Array([
      ...materialsSection(['a']),
      0x28,
      ...encodeArrayHeader(1),
      0x05,
    ])
    const missingCurly = new Uint8Array([
      ...materialsSection(['a']),
      0x28,
      ...encodeArrayHeader(1),
      0x28,
      0x27,
    ])

    // Act
    const parses = [missingKeyword, missingCurly].map(
      (bytes) => () => parseMaterialAnimation(bytes)
    )

    // Assert
    for (const parse of parses) {
      expect(parse).toThrow(
        expect.objectContaining({ failure: TokenReaderFailure.EXPECTED_LEFT_CURLY })
      )
    }
  })

  it('rejects an empty section as an invalid value and a missing section keyword', () => {
    // Arrange
    const empty = new Uint8Array([0x27, ...encodeArrayHeader(0), 0x06])
    const missingSection = new Uint8Array([0x28])

    // Act
    const parseEmpty = () => parseMaterialAnimation(empty)
    const parseMissingSection = () => parseMaterialAnimation(missingSection)

    // Assert
    expect(parseEmpty).toThrow(
      expect.objectContaining({ failure: TokenReaderFailure.INVALID_VALUE })
    )
    expect(parseMissingSection).toThrow(
      expect.objectContaining({ failure: TokenReaderFailure.EXPECTED_KEYWORD })
    )
  })

  it.skipIf(!existsSync(ORIGINAL_JAM_PATH))(
    'parses every material animation in the original LEGO.JAM to its last byte',
    () => {
      // Arrange
      const archive = openJamArchive(new Uint8Array(readFileSync(ORIGINAL_JAM_PATH)))
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.MAB'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        return { path, byteLength: bytes.byteLength, parsed: parseMaterialAnimation(bytes) }
      })

      // Assert
      expect(results).toHaveLength(42)
      for (const { path, byteLength, parsed } of results) {
        expect({ path, readByteCount: parsed.readByteCount }).toEqual({
          path,
          readByteCount: byteLength,
        })
      }
    }
  )
})
