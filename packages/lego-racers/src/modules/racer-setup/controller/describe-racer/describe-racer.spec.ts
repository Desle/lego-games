import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { parseChampionDatabase } from '../../../champion-database/index.ts'
import { parseChassisDatabase } from '../../../chassis-database/index.ts'
import { parseDriverDatabase } from '../../../driver-database/index.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { UnknownRacerRecordError } from '../../types/racer-setup-errors/racer-setup-errors.ts'
import {
  FIXTURE_ARITHMETIC,
  FIXTURE_DATABASES,
  FIXTURE_DRIVER,
} from '../../types/racer-setup-fixtures/racer-setup-fixtures.ts'
import { describeBuiltRacer, describeChampionRacer } from './describe-racer.ts'

describe('describeChampionRacer', () => {
  it('takes the personality and the voice from the driver and the car from its champion and chassis', () => {
    // Arrange
    const driverName = 'KK'

    // Act
    const description = describeChampionRacer(FIXTURE_DATABASES, driverName)

    // Assert
    expect(description).toMatchObject({
      voiceBase: 6 * 12 + 0x44c,
      personalityBytes: [10, 100, 80, 20, 60, 70],
      preferredPowerUpKind: 'shield',
      preferredPowerUpLevel: 1,
      soundValue: 0.5,
      nameStringIdentifier: 18,
    })
    expect(description.car).toMatchObject({
      mass: 4500,
      centreOfMass: { x: -1, y: 0, z: -1 },
      hullExtents: [8, 9],
      weight: 0,
      steeringRating: 60,
      throttleRating: 80,
      topSpeedRating: 50,
    })
    expect(description.car.wheelPoints).toHaveLength(4)
  })

  it.each([
    { code: 0, kind: null },
    { code: 1, kind: 'projectile' },
    { code: 4, kind: 'hazard' },
    { code: 5, kind: null },
  ])('reads preferred power-up code $code as $kind (0x0043b5b8 maps 1 to 4)', ({ code, kind }) => {
    // Arrange
    const databases = {
      ...FIXTURE_DATABASES,
      drivers: {
        drivers: [{ ...FIXTURE_DRIVER, preferredPowerUpCode: code }],
        readByteCount: 0,
      },
    }

    // Act
    const description = describeChampionRacer(databases, 'KK')

    // Assert
    expect(description.preferredPowerUpKind).toBe(kind)
  })

  it('stops at a driver the database does not hold', () => {
    // Arrange
    const driverName = 'ZZ'

    // Act
    const describe = () => describeChampionRacer(FIXTURE_DATABASES, driverName)

    // Assert
    expect(describe).toThrow(UnknownRacerRecordError)
  })

  it('stops at a champion the database does not hold', () => {
    // Arrange
    const databases = { ...FIXTURE_DATABASES, champions: { champions: [], readByteCount: 0 } }

    // Act
    const describe = () => describeChampionRacer(databases, 'KK')

    // Assert
    expect(describe).toThrow(UnknownRacerRecordError)
  })

  it.skipIf(!getIsOriginalJamPresent())(
    'describes every driver of the original driver database',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const databases = {
        drivers: parseDriverDatabase(archive.readFile('GAMEDATA\\COMMON\\DRIVERS.DDB')),
        champions: parseChampionDatabase(archive.readFile('GAMEDATA\\COMMON\\CHAMPS.CCB')),
        chassis: parseChassisDatabase(archive.readFile('GAMEDATA\\COMMON\\CHASSIS.CMB')),
      }

      // Act
      const descriptions = databases.drivers.drivers.map(({ name }) =>
        describeChampionRacer(databases, name)
      )

      // Assert
      expect(descriptions).toHaveLength(24)
      expect(descriptions.map(({ car }) => car.mass)).toEqual(descriptions.map(() => 4500))
      expect(descriptions.every(({ car }) => car.wheelPoints.length === 4)).toBe(true)
    }
  )
})

describe('describeBuiltRacer', () => {
  it('adds the weight to the chassis mass and moves the centre by a quarter of the offsets', () => {
    // Arrange
    const builtCar = { chassisName: 'kkchas0', weight: 120, centreOffsetX: 8, centreOffsetY: -4 }

    // Act
    const description = describeBuiltRacer(FIXTURE_ARITHMETIC, FIXTURE_DATABASES, builtCar, 2)

    // Assert
    expect(description.car).toMatchObject({
      mass: 2620,
      centreOfMass: { x: 1, y: -1, z: -0.5 },
      weight: 120,
      steeringRating: 60,
    })
  })

  it('has a custom driver: personality of 100s, no preferred power-up, voice 1000 plus 100 per racer', () => {
    // Arrange
    const builtCar = { chassisName: 'kkchas0', weight: 0, centreOffsetX: 0, centreOffsetY: 0 }

    // Act
    const description = describeBuiltRacer(FIXTURE_ARITHMETIC, FIXTURE_DATABASES, builtCar, 3)

    // Assert
    expect(description).toMatchObject({
      voiceBase: 1300,
      personalityBytes: [100, 100, 100, 100, 100, 100],
      preferredPowerUpKind: null,
      preferredPowerUpLevel: 0,
      nameStringIdentifier: null,
    })
  })

  it('stops at a chassis the database does not hold', () => {
    // Arrange
    const builtCar = { chassisName: 'nochas0', weight: 0, centreOffsetX: 0, centreOffsetY: 0 }

    // Act
    const describe = () => describeBuiltRacer(FIXTURE_ARITHMETIC, FIXTURE_DATABASES, builtCar, 0)

    // Assert
    expect(describe).toThrow(UnknownRacerRecordError)
  })
})
