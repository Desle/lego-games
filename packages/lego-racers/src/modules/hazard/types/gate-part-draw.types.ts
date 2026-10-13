import type { HazardWorldKey } from './hazard-runtime.types.ts'

// One part of an opening gate as its draw (0x0048f080) hands it to the device: the skeleton instance, the level distances
// it is drawn with (the world's own drawing sees 0 and leaves it out) and the device's alpha override (slot 0xb8, mode 1).
export type GatePartDraw = {
  readonly world: HazardWorldKey
  readonly instanceName: string
  readonly levelSquaredDistances: readonly number[]
  readonly alpha: number
}
