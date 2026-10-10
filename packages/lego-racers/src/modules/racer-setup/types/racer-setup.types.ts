import type { EnumValues } from '../../../shared/types/enum.types.ts'
import type { BrickKind } from '../../power-ups/index.ts'
import type { CarRigidBody, RigidBodyFrame } from '../../racer-physics/index.ts'
import type { CarBodyDefinition } from '../../racer/index.ts'
import type { Vector3 } from '../../simulation-math/index.ts'
import type { ChampionDatabase } from '../../champion-database/index.ts'
import type { ChassisDatabase } from '../../chassis-database/index.ts'
import type { DriverDatabase } from '../../driver-database/index.ts'

// The three databases RacerSet_Setup 0x0043b190 loads for a race (Drivers_Load, Champions_Load, Chassis_Load).
export type RacerDatabases = {
  readonly drivers: DriverDatabase
  readonly champions: ChampionDatabase
  readonly chassis: ChassisDatabase
}

// The car-builder's answer for a player's car, which the front end (0x0042dcb0) writes into the race's racer slot:
// the chassis it sits on (slot +0x08), its weight (+0x14, 0x0049c6a0's total as a float) and where the weight's
// centre lies in x and y (+0x18, +0x1c).
export type BuiltCar = {
  readonly chassisName: string
  readonly weight: number
  readonly centreOffsetX: number
  readonly centreOffsetY: number
}

// What 0x0043b480 collects for 0x004371c0 about one car (the description's +0x1c..+0x5c and +0x84..+0x86).
export type CarDescription = {
  // Description +0x58: the rigid body's mass.
  readonly mass: number
  // Description +0x4c: the local centre of mass.
  readonly centreOfMass: Vector3
  // Description +0x1c..+0x4b: the chassis's four wheel points.
  readonly wheelPoints: readonly Vector3[]
  // The chassis's hull extents (vehicle +0x198 and +0x19c), before 0x004371c0 halves them.
  readonly hullExtents: readonly [number, number]
  // Description +0x5c: a built car's weight; 0 for a champion's car.
  readonly weight: number
  // Description +0x84, +0x85 and +0x86: the chassis's steering, throttle and top speed ratings.
  readonly steeringRating: number
  readonly throttleRating: number
  readonly topSpeedRating: number
}

// What 0x0043b480 hands 0x00436df0: the racer's side of the description.
export type RacerDescription = {
  // Description +0x74 → racer +0xd40.
  readonly voiceBase: number
  // Description +0x6c..+0x71 → racer +0xd1c..+0xd22 (racer-ai's getComputerPersonality).
  readonly personalityBytes: readonly number[]
  // Description +0x7c and +0x80 → racer +0xcd0 and +0xcd4.
  readonly preferredPowerUpKind: EnumValues<typeof BrickKind> | null
  readonly preferredPowerUpLevel: number
  // Description +0x78 → racer +0xd54, read by the engine and nearest-racer sounds only.
  readonly soundValue: number
  // Description +0x18: the identifier of the racer's name in the string table; null for a built car's racer.
  readonly nameStringIdentifier: number | null
  readonly car: CarDescription
}

export type CarBodySetup = CarBodyDefinition

export type CarBodyOptions = {
  readonly displayFrame: RigidBodyFrame
  readonly displayBoundingRadius: number
  // Racer flag 0x4000000 (0x00436df0 from game settings +0x20 bit 0x1): 0x004371c0 sets car rigid body flag 0x100000.
  readonly isRaceModeFlagged: boolean
}

// The car rigid body after the top speed setter, and the scale it applied (car body +0x730).
export type TopSpeedRating = {
  readonly rigidBody: CarRigidBody
  readonly scale: number
}
