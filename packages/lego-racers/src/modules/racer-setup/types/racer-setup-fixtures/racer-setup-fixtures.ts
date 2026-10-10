import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import type { Chassis } from '../../../chassis-database/index.ts'
import type { Champion } from '../../../champion-database/index.ts'
import type { Driver } from '../../../driver-database/index.ts'
import type { CarDescription, RacerDatabases } from '../racer-setup.types.ts'

// Test fixtures: small databases with one driver, one champion and one chassis shaped like the game's.
export const FIXTURE_ARITHMETIC = createFloatArithmetic(FpuPrecision.SINGLE)

export const FIXTURE_DRIVER: Driver = Object.freeze({
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

export const FIXTURE_CHAMPION: Champion = Object.freeze({
  name: 'kk',
  materialLibraryName: 'kkcm',
  textureDatabaseName: 'kkcm',
  modelName: 'kkcm',
  chassisName: 'kkchas0',
  mass: 4500,
  centreOfMass: Object.freeze([-1, 0, -1] as const),
})

export const FIXTURE_CHASSIS: Chassis = Object.freeze({
  name: 'kkchas0',
  variants: Object.freeze([]),
  sharedResourceName: 'kk_brks',
  builtCentreOfMassBase: Object.freeze([-1, 0, -0.5] as const),
  vehiclePoint: Object.freeze([0, 0, 0] as const),
  baseMass: 2500,
  unreadPair: Object.freeze([0, 0] as const),
  hullExtents: Object.freeze([8, 9] as const),
  racerValue: 0.5,
  vehicleValues: Object.freeze([0, 0] as const),
  vehiclePoints: Object.freeze([]),
  wheelPoints: Object.freeze([
    Object.freeze([1.5, -2, 0] as const),
    Object.freeze([1.5, 2, 0] as const),
    Object.freeze([-1.5, -2, 0] as const),
    Object.freeze([-1.5, 2, 0] as const),
  ]),
  unreadIntegers: Object.freeze([0, 0] as const),
  steeringRating: 60,
  throttleRating: 80,
  topSpeedRating: 50,
})

export const FIXTURE_DATABASES: RacerDatabases = Object.freeze({
  drivers: Object.freeze({ drivers: Object.freeze([FIXTURE_DRIVER]), readByteCount: 0 }),
  champions: Object.freeze({ champions: Object.freeze([FIXTURE_CHAMPION]), readByteCount: 0 }),
  chassis: Object.freeze({ chassis: Object.freeze([FIXTURE_CHASSIS]), readByteCount: 0 }),
})

export const FIXTURE_CAR: CarDescription = Object.freeze({
  mass: 4500,
  centreOfMass: Object.freeze({ x: -1, y: 0, z: -1 }),
  wheelPoints: Object.freeze([
    Object.freeze({ x: 1.5, y: -2, z: 0 }),
    Object.freeze({ x: 1.5, y: 2, z: 0 }),
    Object.freeze({ x: -1.5, y: -2, z: 0 }),
    Object.freeze({ x: -1.5, y: 2, z: 0 }),
  ]),
  hullExtents: Object.freeze([8, 9] as const),
  weight: 0,
  steeringRating: 60,
  throttleRating: 80,
  topSpeedRating: 50,
})
