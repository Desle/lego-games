import type { Matrix3, Vector3 } from '../../simulation-math/index.ts'

// 0x0041f730(world, start, end, plane, hitPoint): the track's line probe. It returns false when nothing is hit or the
// material has flag 0x20000 (the probe is not ported; collision.md lists the BSP query that backs it).
export type LineProbeHit = {
  // The hit point written to the caller's buffer (the flight's +0x28).
  readonly point: Vector3
  // Plane floats 9..11 of the triangle record (the unit normal).
  readonly normal: Vector3
}

export type LineProbe = (start: Vector3, end: Vector3) => LineProbeHit | null

// What a racer reports about itself to the flights: its frame position (racer +0x5c, slot 4) and the fields the
// launch routines read.
export type FlightRacer = {
  // Frame position, a float32 triple.
  readonly position: Vector3
  // Racer +0x3f0..+0x3f8, the velocity in units per millisecond.
  readonly velocity: Vector3
  // Racer +0x9e0..+0x9e8 and +0x9ec: a direction and its speed (hypothesis: travel direction and speed per ms).
  readonly heading: Vector3
  readonly headingSpeed: number
  // Racer +0x550..+0x558.
  readonly sideAxis: Vector3
  // Racer +0xb2c is non-null (hypothesis: the vehicle object exists; the magnet only tows racers without one).
  readonly isVehiclePresent: boolean
  // Car body +0x604, the speed 0x0042a7f0 tests.
  readonly speed: number
  // Racer +0xe08 (position at +0x00..+0x08, direction at +0x18..+0x20): where the wand's beam leaves the racer.
  readonly muzzlePosition: Vector3
  readonly muzzleDirection: Vector3
  // The racer's frame +0x3c: position and radius (+0x10), the sphere the wand's beam is tested against.
  readonly boundingCenter: Vector3
  readonly boundingRadius: number
  // Racer +0x2c (the radius of the object at +0x1c): how far from the racer the wand's beam bends to it.
  readonly beamRadius: number
  // Racer +0xcc4: the route node the racer is at (an index into the route), or null.
  readonly routeNodeIndex: number | null
  // Racer +0xe08's rotation (frame +0x28..+0x48): the rocket's launch frame copies it while its animation plays.
  readonly displayRotation: Matrix3
  // Racer +0xd08 is 2: a computer's warp is not carried (0x0045d780 needs the flag +0xdc, which 0x0045dc90 sets only for a
  // human); its scripted body flies the route itself.
  readonly isComputer: boolean
}

// The missile skeleton's launch bone (node 1) at the last frame of rocket k's clip: its position (matrix row 3) and its
// first and third axes (rows 0 and 2), the point and axes 0x00456db0 builds the launched rocket's frame from.
export type RocketLaunchBone = {
  readonly position: Vector3
  readonly firstAxis: Vector3
  readonly thirdAxis: Vector3
}
