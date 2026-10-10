import type { Vector3 } from '../../simulation-math/index.ts'

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
}
