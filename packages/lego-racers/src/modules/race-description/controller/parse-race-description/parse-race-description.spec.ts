import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { TokenReaderFailure } from '../../../token-reader/index.ts'
import { parseRaceDescription } from './parse-race-description.ts'

const ORIGINAL_JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)

const encodeString = (value: string): readonly number[] => [
  0x02,
  ...Array.from({ length: value.length }, (_, index) => value.charCodeAt(index)),
  0x00,
]

const encodeFloat = (value: number): readonly number[] => {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setFloat32(0, value, true)
  return [0x03, ...bytes]
}

const description = (body: readonly number[]): Uint8Array =>
  new Uint8Array([0x35, ...encodeString('Test Track'), 0x05, ...body, 0x06])

describe('parseRaceDescription', () => {
  it('stores each named file and leaves absent ones null', () => {
    // Arrange
    const bytes = description([
      0x2e,
      ...encodeString('rrtrk.wdf'),
      0x33,
      ...encodeString('powerup.pwf'),
      ...encodeString('powerup.maf'),
      ...encodeString('powerup.wdf'),
      0x31,
      ...encodeString('ignored.tob'),
      0x49,
      ...encodeString('camDUM'),
    ])

    // Act
    const parsed = parseRaceDescription(bytes, false)

    // Assert
    expect(parsed).toMatchObject({
      displayName: 'Test Track',
      trackWorld: 'rrtrk.wdf',
      powerUpPlacements: 'powerup.pwf',
      powerUpMaterialAnimation: 'powerup.maf',
      powerUpWorld: 'powerup.wdf',
      trackWorldObject: 'camDUM',
      sky: null,
      readByteCount: bytes.byteLength,
    })
  })

  it('negates the y components of the camera point and vectors when mirrored', () => {
    // Arrange
    const bytes = description([
      0x29,
      ...[1, 2, 3].flatMap(encodeFloat),
      0x28,
      ...[4, 5, 6, 7, 8, 9].flatMap(encodeFloat),
      0x46,
      ...[-700, 700, 800, -800].flatMap(encodeFloat),
    ])

    // Act
    const parsed = parseRaceDescription(bytes, true)

    // Assert
    expect([parsed.cameraPoint, parsed.cameraVectors, parsed.displayBounds]).toEqual([
      [1, -2, 3],
      [
        [4, -5, 6],
        [7, -8, 9],
      ],
      [-700, 700, 800, -800],
    ])
  })

  it('rejects a file name longer than twelve characters', () => {
    // Arrange
    const bytes = description([0x2e, ...encodeString('thirteen.wdfx')])

    // Act
    const parse = () => parseRaceDescription(bytes, false)

    // Assert
    expect(parse).toThrow(expect.objectContaining({ failure: TokenReaderFailure.INVALID_STRING }))
  })

  it('rejects an unknown keyword as a syntax error', () => {
    // Arrange
    const bytes = description([0x36])

    // Act
    const parse = () => parseRaceDescription(bytes, false)

    // Assert
    expect(parse).toThrow(expect.objectContaining({ failure: TokenReaderFailure.SYNTAX_ERROR }))
  })

  it.skipIf(!existsSync(ORIGINAL_JAM_PATH))(
    'parses every race description in the original LEGO.JAM to its last byte',
    () => {
      // Arrange
      const archive = openJamArchive(new Uint8Array(readFileSync(ORIGINAL_JAM_PATH)))
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.RAB'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        return { path, byteLength: bytes.byteLength, parsed: parseRaceDescription(bytes, false) }
      })

      // Assert
      expect(results).toHaveLength(14)
      for (const { path, byteLength, parsed } of results) {
        expect({ path, readByteCount: parsed.readByteCount }).toEqual({
          path,
          readByteCount: byteLength,
        })
      }
      expect(results.find(({ path }) => path.endsWith('RACEC0R0.RAB'))?.parsed).toMatchObject({
        displayName: 'Royal Knights Raceway',
        trackWorld: 'rrtrk.wdf',
        collisionWorld: 'collide.wdf',
        firstCollisionObject: 'collide',
        secondCollisionObject: 'strtlne',
        checkpoints: 'race.cpf',
        checkpointObject: 'chckpt00',
        displayBounds: [-700, 700, 800, -800],
      })
    }
  )
})
