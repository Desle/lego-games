import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { TokenReaderFailure } from '../../../token-reader/index.ts'
import {
  encodeArrayHeader,
  encodeExtendedKeyword,
  encodeFloat,
  encodeInteger,
  encodeString,
} from '../../../../shared/token-encoding/token-encoding.ts'
import { parseBspVolume } from './parse-bsp-volume.ts'

const ORIGINAL_JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)

const integers = (...values: readonly number[]): readonly number[] => values.flatMap(encodeInteger)
const floats = (...values: readonly number[]): readonly number[] => values.flatMap(encodeFloat)

const section = (
  keyword: readonly number[],
  entries: readonly (readonly number[])[]
): readonly number[] => [...keyword, ...encodeArrayHeader(entries.length), ...entries.flat(), 0x06]

describe('parseBspVolume', () => {
  it('reads material names, vectors, entries and fixed-point nodes', () => {
    // Arrange
    const bytes = new Uint8Array([
      ...section([0x27], [encodeString('road'), encodeString('go_thru')]),
      ...section([0x34], [floats(54, 536, 19)]),
      ...section([0x2d], [integers(0, 1, 2, 0x1_0003)]),
      ...section(encodeExtendedKeyword(0x8e), [
        integers(1, -1, 2 ** 30, -(2 ** 29), 0, 4, 5),
        integers(-2, -1, 0, 0, 2 ** 30, 6, 7),
      ]),
    ])

    // Act
    const parsed = parseBspVolume(bytes)

    // Assert
    expect(parsed).toEqual({
      materialNames: ['road', 'go_thru'],
      keyword34Vectors: [[54, 536, 19]],
      keyword2dEntries: [[0, 1, 2, 3]],
      nodes: [
        { childIndices: [1, -1], vector: [1, -0.5, 0], shortValues: [4, 5] },
        { childIndices: [-2, -1], vector: [0, 0, 1], shortValues: [6, 7] },
      ],
      readByteCount: bytes.byteLength,
    })
  })

  it('reads float nodes with keyword children and drops the fourth float', () => {
    // Arrange
    const bytes = new Uint8Array(
      section(encodeExtendedKeyword(0x8b), [
        [
          ...encodeExtendedKeyword(0x8c),
          ...encodeExtendedKeyword(0x8d),
          ...floats(1, 2, 3, 99),
          ...integers(8, 9),
        ],
        [...encodeInteger(0), ...encodeInteger(1), ...floats(0, 0, 0, 0), ...integers(0, 0)],
      ])
    )

    // Act
    const { nodes } = parseBspVolume(bytes)

    // Assert
    expect(nodes).toEqual([
      { childIndices: [-1, -2], vector: [1, 2, 3], shortValues: [8, 9] },
      { childIndices: [0, 1], vector: [0, 0, 0], shortValues: [0, 0] },
    ])
  })

  it('rejects a second material list or vector list as an unexpected keyword', () => {
    // Arrange
    const twoMaterialLists = new Uint8Array([
      ...section([0x27], [encodeString('road')]),
      ...section([0x27], [encodeString('road')]),
    ])
    const twoVectorLists = new Uint8Array([
      ...section([0x34], [floats(0, 0, 0)]),
      ...section([0x34], [floats(0, 0, 0)]),
    ])

    // Act
    const parses = [twoMaterialLists, twoVectorLists].map((bytes) => () => parseBspVolume(bytes))

    // Assert
    for (const parse of parses) {
      expect(parse).toThrow(
        expect.objectContaining({ failure: TokenReaderFailure.UNEXPECTED_KEYWORD })
      )
    }
  })

  it('rejects a negative child other than -1 and -2, and a 16-bit vector count of zero', () => {
    // Arrange
    const badChild = new Uint8Array(
      section(encodeExtendedKeyword(0x8e), [integers(-3, 0, 0, 0, 0, 0, 0)])
    )
    const wrappedCount = new Uint8Array([0x34, ...encodeArrayHeader(0x1_0000), 0x06])

    // Act
    const parseBadChild = () => parseBspVolume(badChild)
    const parseWrappedCount = () => parseBspVolume(wrappedCount)

    // Assert
    expect(parseBadChild).toThrow(
      expect.objectContaining({ failure: TokenReaderFailure.SYNTAX_ERROR })
    )
    expect(parseWrappedCount).toThrow(
      expect.objectContaining({ failure: TokenReaderFailure.EXPECTED_INTEGER })
    )
  })

  it.skipIf(!existsSync(ORIGINAL_JAM_PATH))(
    'parses every BSP volume in the original LEGO.JAM to its last byte',
    () => {
      // Arrange
      const archive = openJamArchive(new Uint8Array(readFileSync(ORIGINAL_JAM_PATH)))
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.BVB'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        return { path, byteLength: bytes.byteLength, parsed: parseBspVolume(bytes) }
      })

      // Assert
      expect(results).toHaveLength(45)
      for (const { path, byteLength, parsed } of results) {
        expect({ path, readByteCount: parsed.readByteCount }).toEqual({
          path,
          readByteCount: byteLength,
        })
      }
    }
  )
})
