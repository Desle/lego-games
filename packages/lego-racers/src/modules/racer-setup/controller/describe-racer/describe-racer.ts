import { findNamedRecord, type NamedRecord } from '../../../named-record/index.ts'
import { getBrickKindFromCode } from '../../../power-ups/index.ts'
import { getFloatFromBits } from '../../../simulation-math/index.ts'
import type { FloatArithmetic, Vector3 } from '../../../simulation-math/index.ts'
import type { Chassis } from '../../../chassis-database/index.ts'
import type { FloatTriple } from '../../../token-reader/index.ts'
import { UnknownRacerRecordError } from '../../types/racer-setup-errors/racer-setup-errors.ts'
import type {
  BuiltCar,
  CarDescription,
  RacerDatabases,
  RacerDescription,
} from '../../types/racer-setup.types.ts'

// 0x0043b480: a champion's voice base is 12 · voice number + 0x44c (0x0043b5a5..0x0043b5a8) ...
const CHAMPION_VOICE_BASE = 0x44c
const CHAMPION_VOICE_STRIDE = 12
// ... and a built car's is (5 · racer index + 50) · 20 (0x0043b829..0x0043b83b).
const BUILT_VOICE_BASE = 1000
const BUILT_VOICE_STRIDE = 100
// A built car's racer has a custom driver's personality: six bytes of 100 (0x0043b7fa..0x0043b822).
const BUILT_PERSONALITY_BYTE = 100
const PERSONALITY_BYTE_COUNT = 6
const CHAMPION_PREFERRED_POWER_UP_CODES = 4
// float32 0.25 at 0x004b053c scales a built car's centre offsets.
const CENTRE_OFFSET_SCALE = getFloatFromBits(0x3e800000)

const toVector = ([x, y, z]: FloatTriple): Vector3 => Object.freeze({ x, y, z })

const getRecord = <Entry extends NamedRecord>(
  records: readonly Entry[],
  databaseName: string,
  recordName: string
): Entry => {
  const record = findNamedRecord(records, recordName)
  if (record === null) throw new UnknownRacerRecordError(databaseName, recordName)
  return record
}

const getCarDescription = (
  chassis: Chassis,
  mass: number,
  centreOfMass: Vector3,
  weight: number
): CarDescription =>
  Object.freeze({
    chassisName: chassis.name,
    mass,
    centreOfMass,
    wheelPoints: Object.freeze(chassis.wheelPoints.map(toVector)),
    hullExtents: chassis.hullExtents,
    weight,
    steeringRating: chassis.steeringRating,
    throttleRating: chassis.throttleRating,
    topSpeedRating: chassis.topSpeedRating,
  })

// 0x0043b480 for a racer named in the driver database (the computer racers of a circuit): the driver gives the
// personality, the voice and the preferred power-up; its champion the mass and centre of mass; the champion's
// chassis the wheels, the hull and the three ratings.
export const describeChampionRacer = (
  databases: RacerDatabases,
  driverName: string
): RacerDescription => {
  const driver = getRecord(databases.drivers.drivers, 'driver', driverName)
  const champion = getRecord(databases.champions.champions, 'champion', driver.championName)
  const chassis = getRecord(databases.chassis.chassis, 'chassis', champion.chassisName)
  const isPreferredCodeKnown =
    driver.preferredPowerUpCode >= 1 &&
    driver.preferredPowerUpCode <= CHAMPION_PREFERRED_POWER_UP_CODES
  return Object.freeze({
    voiceBase: driver.voiceNumber * CHAMPION_VOICE_STRIDE + CHAMPION_VOICE_BASE,
    personalityBytes: driver.personalityBytes,
    preferredPowerUpKind: isPreferredCodeKnown
      ? getBrickKindFromCode(driver.preferredPowerUpCode)
      : null,
    preferredPowerUpLevel: driver.preferredPowerUpLevel,
    soundValue: chassis.racerValue,
    nameStringIdentifier: driver.nameStringIdentifier,
    car: getCarDescription(chassis, champion.mass, toVector(champion.centreOfMass), 0),
  })
}

// 0x0043b480 for a racer with a car built from bricks (an empty name): the chassis comes from the built car's
// record, its mass is the chassis's base mass plus the weight, and the centre of mass is the chassis's base moved
// by a quarter of the weight's centre offsets in x and y.
export const describeBuiltRacer = (
  arithmetic: FloatArithmetic,
  databases: RacerDatabases,
  builtCar: BuiltCar,
  racerIndex: number
): RacerDescription => {
  const { add, multiply, storeFloat } = arithmetic
  const chassis = getRecord(databases.chassis.chassis, 'chassis', builtCar.chassisName)
  const [baseX, baseY, baseZ] = chassis.builtCentreOfMassBase
  const centreOfMass = Object.freeze({
    x: storeFloat(add(multiply(builtCar.centreOffsetX, CENTRE_OFFSET_SCALE), baseX)),
    y: storeFloat(add(multiply(builtCar.centreOffsetY, CENTRE_OFFSET_SCALE), baseY)),
    z: baseZ,
  })
  return Object.freeze({
    voiceBase: BUILT_VOICE_BASE + racerIndex * BUILT_VOICE_STRIDE,
    personalityBytes: Object.freeze(
      Array.from({ length: PERSONALITY_BYTE_COUNT }, () => BUILT_PERSONALITY_BYTE)
    ),
    preferredPowerUpKind: null,
    preferredPowerUpLevel: 0,
    soundValue: chassis.racerValue,
    nameStringIdentifier: null,
    car: getCarDescription(
      chassis,
      storeFloat(add(chassis.baseMass, builtCar.weight)),
      centreOfMass,
      builtCar.weight
    ),
  })
}
