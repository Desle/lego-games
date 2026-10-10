import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { TokenReaderFailure } from '../../../token-reader/index.ts'
import {
  encodeArrayHeader,
  encodeFloat,
  encodeInteger,
} from '../../../../shared/token-encoding/token-encoding.ts'
import { BspTreeNodeKind } from '../../types/bsp-tree-node-kind/bsp-tree-node-kind.ts'
import { parseBspTree } from './parse-bsp-tree.ts'

const ORIGINAL_JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)

const integers = (...values: readonly number[]): readonly number[] => values.flatMap(encodeInteger)
const floats = (...values: readonly number[]): readonly number[] => values.flatMap(encodeFloat)

const section = (keyword: number, entries: readonly (readonly number[])[]): readonly number[] => [
  keyword,
  ...encodeArrayHeader(entries.length),
  ...entries.flat(),
  0x06,
]

describe('parseBspTree', () => {
  it('reads branch and leaf nodes, finds the root, and reads both value sections', () => {
    // Arrange
    const bytes = new Uint8Array([
      ...section(0x27, [
        [0x29, ...integers(1, 0, 35, 0, 187, 0x1_000a)],
        [0x28, ...integers(-5, 0, -1), ...floats(0, -1, 0, 2)],
      ]),
      ...section(0x2a, [floats(1, 2, 3, 4, 5, 6)]),
      ...section(0x2b, [integers(7), integers(-8)]),
    ])

    // Act
    const parsed = parseBspTree(bytes)

    // Assert
    expect(parsed).toEqual({
      nodes: [
        {
          kind: BspTreeNodeKind.LEAF,
          parentIndex: 1,
          childIndices: [-1, -1],
          keyword28Floats: [0, 0, 0, 0],
          keyword29Values: [0, 35, 0, 187, 10],
        },
        {
          kind: BspTreeNodeKind.BRANCH,
          parentIndex: -1,
          childIndices: [0, -1],
          keyword28Floats: [0, -1, 0, 2],
          keyword29Values: [0, 0, 0, 0, 0],
        },
      ],
      rootIndex: 1,
      keyword2aEntries: [[1, 2, 3, 4, 5, 6]],
      keyword2bValues: [7, -8],
      readByteCount: bytes.byteLength,
    })
  })

  it('rejects a branch without children as unsupported', () => {
    // Arrange
    const bytes = new Uint8Array(
      section(0x27, [[0x28, ...integers(-1, -1, -2), ...floats(0, 0, 0, 0)]])
    )

    // Act
    const parse = () => parseBspTree(bytes)

    // Assert
    expect(parse).toThrow(expect.objectContaining({ failure: TokenReaderFailure.UNSUPPORTED }))
  })

  it('rejects an empty section, an unknown node and an unknown section', () => {
    // Arrange
    const empty = new Uint8Array([0x2b, ...encodeArrayHeader(0), 0x06])
    const unknownNode = new Uint8Array(section(0x27, [[0x2a]]))
    const unknownSection = new Uint8Array([0x2c])

    // Act
    const parses = [empty, unknownNode, unknownSection].map((bytes) => () => parseBspTree(bytes))

    // Assert
    expect(parses[0]).toThrow(
      expect.objectContaining({ failure: TokenReaderFailure.EXPECTED_INTEGER })
    )
    expect(parses[1]).toThrow(expect.objectContaining({ failure: TokenReaderFailure.SYNTAX_ERROR }))
    expect(parses[2]).toThrow(expect.objectContaining({ failure: TokenReaderFailure.SYNTAX_ERROR }))
  })

  it.skipIf(!existsSync(ORIGINAL_JAM_PATH))(
    'parses every BSP tree in the original LEGO.JAM to its last byte',
    () => {
      // Arrange
      const archive = openJamArchive(new Uint8Array(readFileSync(ORIGINAL_JAM_PATH)))
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.BDB'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        return { path, byteLength: bytes.byteLength, parsed: parseBspTree(bytes) }
      })

      // Assert
      expect(results).toHaveLength(14)
      for (const { path, byteLength, parsed } of results) {
        expect({ path, readByteCount: parsed.readByteCount }).toEqual({
          path,
          readByteCount: byteLength,
        })
        const mismatchedChildren = parsed.nodes.flatMap((node, index) =>
          node.childIndices.filter(
            (childIndex) => childIndex >= 0 && parsed.nodes[childIndex]?.parentIndex !== index
          )
        )
        expect({ path, mismatchedChildren }).toEqual({ path, mismatchedChildren: [] })
      }
    }
  )
})
