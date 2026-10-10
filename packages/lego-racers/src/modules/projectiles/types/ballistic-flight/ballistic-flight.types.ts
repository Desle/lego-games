import type { EnumValues } from '../../../../shared/types/enum.types.ts'
import type { Vector3 } from '../../../simulation-math/index.ts'
import type { FlightRacer } from '../projectiles.types.ts'
import type { BallisticFlightState as BallisticFlightStateValues } from './ballistic-flight.ts'

export type BallisticFlightState = EnumValues<typeof BallisticFlightStateValues>

// The launch parameter block every flight start fills in (read by 0x00430d40 and the three launch routines).
export type BallisticLaunchParameters = {
  // +0x08: the gravity along z, copied to flight +0x40.
  readonly gravity: number
  // +0x1c: the horizontal speed in units per second.
  readonly speed: number
  // +0x10, +0x14, +0x18: added to the target after the lead.
  readonly targetOffset: Vector3
  // +0x20: the flight ends by itself after this many milliseconds, copied to flight +0x58.
  readonly maximumDurationMilliseconds: number
  // +0x24: added to the shooter's z when a flight starts at the shooter, copied to flight +0x48.
  readonly heightOffset: number
}

// The body of 0x00430ca0 (vtable 0x004b0778, flights of the cannon, barrel and, derived, the grapple).
export type BallisticFlight = {
  // +0x04.
  readonly state: BallisticFlightState
  // The projectile model's frame position (the object at +0x08, vtable slots 4 and 8).
  readonly framePosition: Vector3
  // +0x10..+0x18: where it started.
  readonly startPosition: Vector3
  // +0x1c..+0x24: where it was aimed.
  readonly targetPosition: Vector3
  // +0x28..+0x30: where it ended (the probe's hit point, a racer's position or its last position).
  readonly endPosition: Vector3
  // +0x34, +0x38 and +0x3c: the launch velocity in units per second.
  readonly velocityX: number
  readonly velocityY: number
  readonly launchVelocityZ: number
  // +0x40.
  readonly gravity: number
  // +0x48.
  readonly heightOffset: number
  // +0x4c: the horizontal speed of the arc.
  readonly horizontalSpeed: number
  // +0x50, milliseconds flown.
  readonly elapsedMilliseconds: number
  // +0x54: the milliseconds the arc takes to reach its target.
  readonly durationMilliseconds: number
  // +0x58.
  readonly maximumDurationMilliseconds: number
  // +0x5c..+0x64: the unit normal of the surface it hit.
  readonly hitNormal: Vector3
  // +0x9c: the racer that shot it; racers other than this one can touch it.
  readonly shooterRacer: number | null
  // +0xa0: the racer it was aimed at.
  readonly targetRacer: number | null
  // +0xa4: the racer that touched it.
  readonly touchedRacer: number | null
}

export type BallisticFlightAdvance = {
  readonly flight: BallisticFlight
  readonly result: BallisticFlightState
}

// 0x00430d80's arguments after the parameters.
export type RacerLaunchRequest = {
  readonly shooter: number
  readonly shooterRacer: FlightRacer
  readonly target: number
  readonly targetRacer: FlightRacer
  readonly isFromShooter: boolean
  readonly isLeadLimited: boolean
}

// 0x00431050's arguments after the parameters.
export type PointLaunchRequest = {
  readonly shooter: number
  readonly shooterRacer: FlightRacer
  readonly point: Vector3
  readonly pointVelocity: Vector3
  readonly isFromShooter: boolean
}

// How far the target is and how far the shooter's heading points along the line to it.
export type LineToPoint = {
  readonly distance: number
  readonly alignment: number
}
