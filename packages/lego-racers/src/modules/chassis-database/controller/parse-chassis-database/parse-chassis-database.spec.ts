import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { floatTokens, LEFT_CURLY, RIGHT_CURLY } from '../../../../shared/testing/token-bytes.ts'
import {
  encodeArrayHeader,
  encodeInteger,
  encodeString,
} from '../../../../shared/token-encoding/token-encoding.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { findNamedRecord } from '../../../named-record/index.ts'
import { TokenReaderFailure } from '../../../token-reader/index.ts'
import {
  ChassisKeyword,
  ChassisVariantKeyword,
} from '../../types/chassis-keyword/chassis-keyword.ts'
import { parseChassisDatabase } from './parse-chassis-database.ts'

const getFile = (blocks: readonly (readonly number[])[]): Uint8Array =>
  new Uint8Array([
    ChassisKeyword.CHASSIS,
    ...encodeArrayHeader(blocks.length),
    ...blocks.flat(),
    RIGHT_CURLY,
  ])

const getBlock = (name: string, body: readonly number[]): readonly number[] => [
  ChassisKeyword.CHASSIS,
  ...encodeString(name),
  LEFT_CURLY,
  ...body,
  RIGHT_CURLY,
]

const POINTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

const FULL_BODY = [
  ChassisKeyword.FIRST_VARIANT,
  LEFT_CURLY,
  ChassisVariantKeyword.MATERIAL_LIBRARY,
  ...encodeString('mat'),
  ChassisVariantKeyword.TEXTURE_DATABASE,
  ...encodeString('tex'),
  ChassisVariantKeyword.MODEL,
  ...encodeString('mod'),
  ChassisVariantKeyword.SKELETON,
  ...encodeString('ske'),
  ChassisVariantKeyword.ANIMATION,
  ...encodeString('ani'),
  RIGHT_CURLY,
  ChassisKeyword.SECOND_VARIANT,
  LEFT_CURLY,
  ChassisVariantKeyword.MODEL,
  ...encodeString('mod2'),
  RIGHT_CURLY,
  ChassisKeyword.SHARED_RESOURCE_NAME,
  ...encodeString('brks'),
  ChassisKeyword.BUILT_CENTRE_OF_MASS_BASE,
  ...floatTokens([-1, 0, -0.5]),
  ChassisKeyword.VEHICLE_POINT,
  ...floatTokens([0.5, 0.25, 2]),
  ChassisKeyword.BASE_MASS,
  ...floatTokens([2500]),
  ChassisKeyword.UNREAD_PAIR,
  ...floatTokens([4, 10.5]),
  ChassisKeyword.HULL_EXTENTS,
  ...floatTokens([8, 9]),
  ChassisKeyword.RACER_VALUE,
  ...floatTokens([0.75]),
  ChassisKeyword.VEHICLE_BLOCK,
  LEFT_CURLY,
  ...floatTokens([0.5, 1.5]),
  ...floatTokens(POINTS),
  RIGHT_CURLY,
  ChassisKeyword.WHEEL_BLOCK,
  LEFT_CURLY,
  ...floatTokens(POINTS.map((value) => value * 2)),
  RIGHT_CURLY,
  ChassisKeyword.FIRST_UNREAD_INTEGER,
  ...encodeInteger(11),
  ChassisKeyword.SECOND_UNREAD_INTEGER,
  ...encodeInteger(22),
  ChassisKeyword.STEERING_RATING,
  ...encodeInteger(61),
  ChassisKeyword.TOP_SPEED_RATING,
  ...encodeInteger(63),
  ChassisKeyword.THROTTLE_RATING,
  ...encodeInteger(62),
]

describe('parseChassisDatabase', () => {
  it('reads every field of a chassis block', () => {
    // Arrange
    const bytes = getFile([getBlock('dachas0', FULL_BODY)])

    // Act
    const database = parseChassisDatabase(bytes)

    // Assert
    const [chassis] = database.chassis
    expect(chassis).toMatchObject({
      name: 'dachas0',
      sharedResourceName: 'brks',
      builtCentreOfMassBase: [-1, 0, -0.5],
      vehiclePoint: [0.5, 0.25, 2],
      baseMass: 2500,
      unreadPair: [4, 10.5],
      hullExtents: [8, 9],
      racerValue: 0.75,
      vehicleValues: [0.5, 1.5],
      vehiclePoints: [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
        [10, 11, 12],
      ],
      wheelPoints: [
        [2, 4, 6],
        [8, 10, 12],
        [14, 16, 18],
        [20, 22, 24],
      ],
      unreadIntegers: [11, 22],
      steeringRating: 61,
      throttleRating: 62,
      topSpeedRating: 63,
    })
    expect(chassis?.variants).toEqual([
      {
        materialLibraryName: 'mat',
        textureDatabaseName: 'tex',
        modelName: 'mod',
        skeletonName: 'ske',
        animationName: 'ani',
      },
      {
        materialLibraryName: '',
        textureDatabaseName: '',
        modelName: 'mod2',
        skeletonName: '',
        animationName: '',
      },
    ])
    expect(database.readByteCount).toBe(bytes.byteLength)
  })

  it('starts the three ratings at 50, 80 and 50 (0x0041db10 stores 0x32, 0x50, 0x32)', () => {
    // Arrange
    const bytes = getFile([getBlock('dachas0', [])])

    // Act
    const [chassis] = parseChassisDatabase(bytes).chassis

    // Assert
    expect(chassis).toMatchObject({ steeringRating: 50, throttleRating: 80, topSpeedRating: 50 })
  })

  it('skips an unknown keyword inside a variant block without reading a value', () => {
    // Arrange
    const bytes = getFile([
      getBlock('dachas0', [
        ChassisKeyword.FIRST_VARIANT,
        LEFT_CURLY,
        0x3f,
        ChassisVariantKeyword.MODEL,
        ...encodeString('mod'),
        RIGHT_CURLY,
      ]),
    ])

    // Act
    const [chassis] = parseChassisDatabase(bytes).chassis

    // Assert
    expect(chassis?.variants[0]?.modelName).toBe('mod')
  })

  it('stops with a syntax error at a record keyword it does not know', () => {
    // Arrange
    const bytes = getFile([getBlock('dachas0', [0x3d, ...encodeInteger(1)])])

    // Act
    const parse = () => parseChassisDatabase(bytes)

    // Assert
    expect(parse).toThrow(expect.objectContaining({ failure: TokenReaderFailure.SYNTAX_ERROR }))
  })

  it.skipIf(!getIsOriginalJamPresent())(
    'parses every chassis database in the original LEGO.JAM to its last byte',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.CMB'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        return { path, byteLength: bytes.byteLength, parsed: parseChassisDatabase(bytes) }
      })

      // Assert
      expect(results).toHaveLength(2)
      for (const { path, byteLength, parsed } of results) {
        expect({ path, readByteCount: parsed.readByteCount }).toEqual({
          path,
          readByteCount: byteLength,
        })
      }
      const race = results.find(({ path }) => path.includes('GAMEDATA'))
      expect(race?.parsed.chassis).toHaveLength(24)
      expect(findNamedRecord(race?.parsed.chassis ?? [], 'kkchas0')).toMatchObject({
        baseMass: 2500,
        hullExtents: [8, 9],
        steeringRating: 60,
        throttleRating: 80,
        topSpeedRating: 50,
        wheelPoints: [
          [Math.fround(1.5432), Math.fround(-1.9889), 0],
          [Math.fround(1.5432), Math.fround(1.9889), 0],
          [Math.fround(-1.4383), Math.fround(-1.9889), 0],
          [Math.fround(-1.4383), Math.fround(1.9889), 0],
        ],
      })
    }
  )
})
