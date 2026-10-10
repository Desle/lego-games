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
  encodeString,
} from '../../../../shared/token-encoding/token-encoding.ts'
import { parseSkeleton } from './parse-skeleton.ts'

const ORIGINAL_JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)

const boneBlock = (name: string, body: readonly number[]): readonly number[] => [
  0x27,
  ...encodeString(name),
  0x05,
  ...body,
  0x06,
]

const bonesBlock = (blocks: readonly (readonly number[])[]): readonly number[] => [
  0x27,
  ...encodeArrayHeader(blocks.length),
  ...blocks.flat(),
  0x06,
]

const floats = (...values: readonly number[]): readonly number[] => values.flatMap(encodeFloat)

describe('parseSkeleton', () => {
  it('reads bones with position, quaternion and parent', () => {
    // Arrange
    const bytes = new Uint8Array(
      bonesBlock([
        boneBlock('alpelvis', [0x28, ...floats(0, 0, 0), 0x29, ...floats(0, 0, 0, 1)]),
        boneBlock('torso', [0x28, ...floats(1, 2, 3), 0x2a, ...encodeString('alpelvis')]),
      ])
    )

    // Act
    const parsed = parseSkeleton(bytes)

    // Assert
    expect(parsed).toEqual({
      bones: [
        { name: 'alpelvis', position: [0, 0, 0], quaternion: [0, 0, 0, 1], parentIndex: null },
        { name: 'torso', position: [1, 2, 3], quaternion: null, parentIndex: 0 },
      ],
      readByteCount: bytes.byteLength,
    })
  })

  it('skips unknown tokens inside a bone and lets a bone name itself as parent', () => {
    // Arrange
    const bytes = new Uint8Array(
      bonesBlock([boneBlock('self', [0x30, ...encodeFloat(1), 0x2a, ...encodeString('self')])])
    )

    // Act
    const [bone] = parseSkeleton(bytes).bones

    // Assert
    expect(bone).toEqual({ name: 'self', position: null, quaternion: null, parentIndex: 0 })
  })

  it('keeps only the last bones block', () => {
    // Arrange
    const bytes = new Uint8Array([
      ...bonesBlock([boneBlock('first', [])]),
      ...bonesBlock([boneBlock('first', []), boneBlock('second', [])]),
    ])

    // Act
    const parsed = parseSkeleton(bytes)

    // Assert
    expect(parsed.bones.map((bone) => bone.name)).toEqual(['first', 'second'])
  })

  it('rejects a parent that is not named yet as an invalid string', () => {
    // Arrange
    const bytes = new Uint8Array(
      bonesBlock([boneBlock('child', [0x2a, ...encodeString('later')]), boneBlock('later', [])])
    )

    // Act
    const parse = () => parseSkeleton(bytes)

    // Assert
    expect(parse).toThrow(expect.objectContaining({ failure: TokenReaderFailure.INVALID_STRING }))
  })

  it('rejects a duplicate bone, an empty block and a stray top-level token', () => {
    // Arrange
    const duplicate = new Uint8Array(bonesBlock([boneBlock('twin', []), boneBlock('twin', [])]))
    const empty = new Uint8Array([0x27, ...encodeArrayHeader(0), 0x06])
    const stray = new Uint8Array([0x28])

    // Act
    const parseDuplicate = () => parseSkeleton(duplicate)
    const parseEmpty = () => parseSkeleton(empty)
    const parseStray = () => parseSkeleton(stray)

    // Assert
    expect(parseDuplicate).toThrow(new DuplicateNameError('twin'))
    expect(parseEmpty).toThrow(
      expect.objectContaining({ failure: TokenReaderFailure.EXPECTED_INTEGER })
    )
    expect(parseStray).toThrow(
      expect.objectContaining({ failure: TokenReaderFailure.SYNTAX_ERROR })
    )
  })

  it('refuses a bone the file ends inside', () => {
    // Arrange
    const bytes = new Uint8Array([
      0x27,
      ...encodeArrayHeader(1),
      0x27,
      ...encodeString('open'),
      0x05,
    ])

    // Act
    const parse = () => parseSkeleton(bytes)

    // Assert
    expect(parse).toThrow(UnportableFileError)
  })

  it.skipIf(!existsSync(ORIGINAL_JAM_PATH))(
    'parses every skeleton in the original LEGO.JAM to its last byte',
    () => {
      // Arrange
      const archive = openJamArchive(new Uint8Array(readFileSync(ORIGINAL_JAM_PATH)))
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.SDB'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        return { path, byteLength: bytes.byteLength, parsed: parseSkeleton(bytes) }
      })

      // Assert
      expect(results).toHaveLength(417)
      for (const { path, byteLength, parsed } of results) {
        expect({ path, readByteCount: parsed.readByteCount }).toEqual({
          path,
          readByteCount: byteLength,
        })
      }
    }
  )
})
