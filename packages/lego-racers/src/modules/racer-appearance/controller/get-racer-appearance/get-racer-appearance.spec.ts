import type { Champion } from '../../../champion-database/index.ts'
import type { Chassis } from '../../../chassis-database/index.ts'
import type { Driver } from '../../../driver-database/index.ts'
import { UnknownRacerRecordError } from '../../../racer-setup/index.ts'
import type { RacerDatabases } from '../../../racer-setup/index.ts'
import { getBuiltRacerAppearance, getChampionRacerAppearance } from './get-racer-appearance.ts'

const DRIVER: Driver = Object.freeze({
  name: 'KK',
  nameStringIdentifier: 18,
  materialLibraryName: 'kkpelvis',
  textureDatabaseName: 'kkpelvis',
  modelName: 'kkpelvis',
  championName: 'kk',
  preferredPowerUpCode: 2,
  preferredPowerUpLevel: 1,
  personalityBytes: Object.freeze([10, 100, 80, 20, 60, 70]),
  voiceNumber: 6,
  unreadBytes: Object.freeze([7, 1, 1, 17, 0]),
})
const CHAMPION: Champion = Object.freeze({
  name: 'kk',
  materialLibraryName: 'kkcm',
  textureDatabaseName: 'kkcm',
  modelName: 'kkcm',
  chassisName: 'kkchas0',
  mass: 4500,
  centreOfMass: Object.freeze([-1, 0, -1] as const),
})
const EMPTY_VARIANT = Object.freeze({
  materialLibraryName: '',
  textureDatabaseName: '',
  modelName: '',
  skeletonName: '',
  animationName: '',
})
const WHEEL_VARIANT = Object.freeze({
  materialLibraryName: 'kkjmw',
  textureDatabaseName: 'kkjmw',
  modelName: 'kkjmw',
  skeletonName: 'kkjmw',
  animationName: 'kkjmw',
})
const CHASSIS: Chassis = Object.freeze({
  name: 'kkchas0',
  variants: Object.freeze([WHEEL_VARIANT, EMPTY_VARIANT]),
  sharedResourceName: 'kk_brks',
  builtCentreOfMassBase: Object.freeze([-1, 0, -0.5] as const),
  vehiclePoint: Object.freeze([-1.5, 0.25, 2.125] as const),
  baseMass: 2500,
  unreadPair: Object.freeze([0, 0] as const),
  hullExtents: Object.freeze([8, 9] as const),
  racerValue: 0.5,
  vehicleValues: Object.freeze([0, 0] as const),
  vehiclePoints: Object.freeze([]),
  wheelPoints: Object.freeze([]),
  unreadIntegers: Object.freeze([0, 0] as const),
  steeringRating: 60,
  throttleRating: 80,
  topSpeedRating: 50,
})
const DATABASES: RacerDatabases = Object.freeze({
  drivers: { drivers: [DRIVER], readByteCount: 0 },
  champions: { champions: [CHAMPION], readByteCount: 0 },
  chassis: { chassis: [CHASSIS], readByteCount: 0 },
})

describe('getChampionRacerAppearance', () => {
  it('names the champion body, the chassis wheels and the driver with the pelvis bones', () => {
    // Arrange / Act
    const appearance = getChampionRacerAppearance(DATABASES, 'KK', 1)

    // Assert
    expect(appearance.bodyModel).toEqual({
      textureDatabaseName: 'kkcm',
      materialLibraryName: 'kkcm',
      modelName: 'kkcm',
      skeletonName: '',
      animationName: '',
    })
    expect(appearance.wheelModel).toEqual(WHEEL_VARIANT)
    expect(appearance.driverModel).toEqual({
      textureDatabaseName: 'kkpelvis',
      materialLibraryName: 'kkpelvis',
      modelName: 'kkpelvis',
      skeletonName: 'pelvis',
      animationName: 'pelvis',
    })
  })

  it('seats the driver at the chassis vehicle point and shades with the racer index', () => {
    // Arrange / Act
    const appearance = getChampionRacerAppearance(DATABASES, 'KK', 4)

    // Assert
    expect(appearance.seatPoint).toEqual({ x: -1.5, y: 0.25, z: 2.125 })
    expect(appearance.shadowImageName).toBe('carshad4')
    expect(appearance.sharedResourceName).toBe('kk_brks')
  })

  it('has no second wheel model when the chassis leaves the second variant empty', () => {
    // Arrange / Act
    const appearance = getChampionRacerAppearance(DATABASES, 'KK', 0)

    // Assert
    expect(appearance.secondWheelModel).toBeNull()
  })

  it('refuses a driver the database does not hold', () => {
    // Arrange / Act / Assert
    expect(() => getChampionRacerAppearance(DATABASES, 'ZZ', 0)).toThrow(UnknownRacerRecordError)
  })
})

describe('getBuiltRacerAppearance', () => {
  it('leaves the car body and the driver to the builders and keeps the chassis wheels', () => {
    // Arrange / Act
    const appearance = getBuiltRacerAppearance(DATABASES, 'kkchas0', 0)

    // Assert
    expect(appearance.bodyModel).toBeNull()
    expect(appearance.driverModel).toBeNull()
    expect(appearance.wheelModel.modelName).toBe('kkjmw')
  })
})
