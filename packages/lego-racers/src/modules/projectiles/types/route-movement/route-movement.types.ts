import type { Vector3 } from '../../../simulation-math/index.ts'

// One 0x24-byte entry of the race's route (racer set +0x10, entries from 0x0041e940): a plane (+0x00 normal, +0x0c
// offset), a position (+0x10) and the index of the next entry (the byte at +0x20).
export type RouteNode = {
  readonly normal: Vector3
  readonly planeOffset: number
  readonly position: Vector3
  readonly nextIndex: number
}
