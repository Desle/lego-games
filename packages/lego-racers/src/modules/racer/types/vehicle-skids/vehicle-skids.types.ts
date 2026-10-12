import type { Vector3 } from '../../../simulation-math/index.ts'

// Where one wheel is this step and whether its flag asks for a mark (bit 0x1 after 0x0043f1e0's second part).
export type VehicleSkidWheel = {
  readonly position: Vector3
  readonly isMarking: boolean
}

// What 0x0043f1e0 hands the trails (vehicle +0x1e4..) in one vehicle update: the wheels, the milliseconds, and whether the
// wheels spin (vehicle flag 0x100, which makes the short kind of trail).
export type VehicleSkidStep = {
  readonly index: number
  readonly elapsedMilliseconds: number
  readonly isSpinning: boolean
  readonly wheels: readonly VehicleSkidWheel[]
}

// The vehicle's skid mark state: +0x1f4 the four wheel flags (bit 0x1 asks for a mark, 0x2 the wheel stood on the
// ground, 0x4 a cooldown), +0x1f8 the milliseconds each wheel has been off the ground, +0x208 the cooldowns, +0x1a8 the
// wheel points in the car's frame, +0x1a0 and +0x1a4 the width of the front and the rear marks, +0x224 the image of the
// marks.
export type VehicleSkids = {
  readonly flags: readonly number[]
  readonly wheelMilliseconds: readonly number[]
  readonly cooldownMilliseconds: readonly number[]
  readonly wheelPoints: readonly Vector3[]
  readonly widths: readonly [number, number]
  readonly imageName: string
  // How often 0x0043dcd0 let the trails go (they fade over a second).
  readonly releaseCount: number
  // The last update's step, or null before the first.
  readonly step: VehicleSkidStep | null
}

export type VehicleWheelMarks = {
  readonly points: readonly Vector3[]
  readonly widths: readonly [number, number]
}
