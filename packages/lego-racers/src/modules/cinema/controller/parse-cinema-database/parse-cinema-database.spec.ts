import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openJamArchive } from '../../../jam-archive/index.ts'
import {
  encodeArrayHeader,
  encodeFloat,
  encodeInteger,
  encodeString,
} from '../../../../shared/token-encoding/token-encoding.ts'
import {
  getActiveCinemaActions,
  getCinemaFrame,
} from '../get-cinema-playback/get-cinema-playback.ts'
import { parseCinemaDatabase } from './parse-cinema-database.ts'

const ORIGINAL_JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)
const LEFT_CURLY = 0x05
const RIGHT_CURLY = 0x06

const keyword = (token: number, ...values: readonly (readonly number[])[]): readonly number[] => [
  token,
  ...values.flat(),
]

// One cinema `castle2` of 200 frames at 30 per second in the world `pst`: its camera object and the skeleton instance
// `guy1` playing clip 1.
const sampleFile = (): Uint8Array =>
  new Uint8Array([
    ...keyword(0x28, encodeArrayHeader(1), encodeString('pst'), [RIGHT_CURLY]),
    ...keyword(0x27, encodeArrayHeader(1)),
    ...keyword(0x27, encodeString('castle2'), [LEFT_CURLY]),
    ...keyword(0x29, encodeArrayHeader(1)),
    ...keyword(0x29, encodeString('Camera1'), [LEFT_CURLY]),
    ...keyword(0x2a, encodeString('Camera01')),
    ...keyword(0x2b, encodeInteger(0)),
    ...keyword(0x2c, encodeInteger(200)),
    ...keyword(0x2d, encodeInteger(1)),
    RIGHT_CURLY,
    RIGHT_CURLY,
    ...keyword(0x2e, encodeArrayHeader(1)),
    ...keyword(0x2e, encodeString('guy11'), [LEFT_CURLY]),
    ...keyword(0x30, encodeString('guy1')),
    ...keyword(0x33, encodeFloat(3.5), encodeFloat(-40), encodeFloat(2)),
    ...keyword(
      0x34,
      encodeFloat(1),
      encodeFloat(0),
      encodeFloat(0),
      encodeFloat(0),
      encodeFloat(0),
      encodeFloat(1)
    ),
    ...keyword(0x2d, encodeInteger(1)),
    ...keyword(0x2b, encodeInteger(10)),
    ...keyword(0x2c, encodeInteger(90)),
    RIGHT_CURLY,
    RIGHT_CURLY,
    ...keyword(0x3b, encodeInteger(30)),
    RIGHT_CURLY,
    RIGHT_CURLY,
  ])

describe('parseCinemaDatabase', () => {
  it('reads the worlds, the objects, the skeleton instance actions and the clock of a cinema', () => {
    // Arrange / Act
    const database = parseCinemaDatabase(sampleFile())

    // Assert
    expect(database.worldNames).toEqual(['pst'])
    expect(database.cinemas).toHaveLength(1)
    const [cinema] = database.cinemas
    expect(cinema?.name).toBe('castle2')
    expect(cinema?.framesPerSecond).toBe(30)
    expect(cinema?.lengthFrames).toBe(200)
    expect(cinema?.objects[0]).toMatchObject({ target: 'Camera01', flag: 1, durationFrames: 200 })
    expect(cinema?.actions[0]).toMatchObject({
      kind: 2,
      instanceName: 'guy1',
      flag: 1,
      position: [3.5, -40, 2],
      startFrame: 10,
      durationFrames: 90,
    })
  })

  it('loops the clock and lists the actions on the timeline at a time', () => {
    // Arrange
    const [cinema] = parseCinemaDatabase(sampleFile()).cinemas
    if (cinema === undefined) throw new RangeError('The sample has a cinema')

    // Act
    const early = getActiveCinemaActions(cinema, 100)
    const middle = getActiveCinemaActions(cinema, 1000)
    const looped = getCinemaFrame(cinema, 6000 + 1000)

    // Assert
    expect(early).toEqual([])
    expect(middle).toHaveLength(1)
    expect(looped).toBe(9)
  })

  it.skipIf(!existsSync(ORIGINAL_JAM_PATH))(
    'reads the race previews of the original (13 cinemas, each with a guy1 action)',
    () => {
      // Arrange
      const archive = openJamArchive(new Uint8Array(readFileSync(ORIGINAL_JAM_PATH)))

      // Act
      const database = parseCinemaDatabase(archive.readFile('MENUDATA\\SINGRACE\\PST.CDB'))

      // Assert
      expect(database.worldNames).toEqual(['pst', 'blended', 'emitter'])
      expect(database.cinemas.map((cinema) => cinema.name)).toHaveLength(13)
      expect(
        database.cinemas.every((cinema) =>
          cinema.actions.some((action) => action.instanceName === 'guy1')
        )
      ).toBe(true)
      expect(
        database.cinemas.map(
          (cinema) =>
            cinema.actions.find((action) => action.kind === 2 && action.instanceName === 'guy1')
              ?.flag
        )
      ).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    }
  )
})
