import type { Vector3 } from '../../types/hazard.types.ts'

// One vent of the magma track (0x004c22d8, 0x004b44c8, 0x004b44d4): where the smoke spills and the clip times
// (frames) the lava sinks and rises at it.
export type LavaVent = {
  readonly position: Vector3
  readonly sinkFrame: number
  readonly riseFrame: number
}
