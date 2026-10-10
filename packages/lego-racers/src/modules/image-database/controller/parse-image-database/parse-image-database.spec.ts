import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { TokenReaderFailure } from '../../../token-reader/index.ts'
import { DuplicateNameError } from '../../../../shared/errors/gol-file-errors.ts'
import {
  encodeArrayHeader,
  encodeInteger,
  encodeString,
} from '../../../../shared/token-encoding/token-encoding.ts'
import { parseImageDatabase } from './parse-image-database.ts'

const ORIGINAL_JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)

const imageBlock = (name: string, body: readonly number[]): readonly number[] => [
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

describe('parseImageDatabase', () => {
  it('starts every image from zero flags, black and white byte triples', () => {
    // Arrange
    const bytes = database([imageBlock('speed', [])])

    // Act
    const parsed = parseImageDatabase(bytes)

    // Assert
    expect(parsed).toEqual({
      images: [
        { name: 'speed', flags: 0, keyword2bBytes: [0, 0, 0], keyword2cBytes: [255, 255, 255] },
      ],
      readByteCount: bytes.byteLength,
    })
  })

  it('applies every keyword in file order and adds 0x800 with flag 0x20', () => {
    // Arrange
    const body = [0x28, 0x2a, 0x29, 0x2b, ...triple(1, 2, 3), 0x2c, ...triple(4, 5, 0x106)]
    const bytes = database([imageBlock('dot', body)])

    // Act
    const [image] = parseImageDatabase(bytes).images

    // Assert
    expect(image).toEqual({
      name: 'dot',
      flags: 0x4 | 0x8 | 0x20 | 0x800,
      keyword2bBytes: [1, 2, 3],
      keyword2cBytes: [4, 5, 6],
    })
  })

  it('rejects a second image with the same name', () => {
    // Arrange
    const bytes = database([imageBlock('twin', []), imageBlock('twin', [])])

    // Act
    const parse = () => parseImageDatabase(bytes)

    // Assert
    expect(parse).toThrow(new DuplicateNameError('twin'))
  })

  it('rejects an unknown keyword as a syntax error', () => {
    // Arrange
    const bytes = database([imageBlock('bad', [0x2d])])

    // Act
    const parse = () => parseImageDatabase(bytes)

    // Assert
    expect(parse).toThrow(expect.objectContaining({ failure: TokenReaderFailure.SYNTAX_ERROR }))
  })

  it.skipIf(!existsSync(ORIGINAL_JAM_PATH))(
    'parses every image database in the original LEGO.JAM to its last byte',
    () => {
      // Arrange
      const archive = openJamArchive(new Uint8Array(readFileSync(ORIGINAL_JAM_PATH)))
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.IDB'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        const parsed = parseImageDatabase(bytes)
        return { path, parsed, unreadBytes: [...bytes.subarray(parsed.readByteCount)] }
      })

      // Assert
      expect(results).toHaveLength(23)
      for (const { path, parsed, unreadBytes } of results) {
        // An empty database stops after its `{`; only the closing `}` stays unread.
        const expectedUnreadBytes = parsed.images.length === 0 ? [0x06] : []
        expect({ path, unreadBytes }).toEqual({ path, unreadBytes: expectedUnreadBytes })
      }
    }
  )
})
