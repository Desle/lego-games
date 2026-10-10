import type { PowerUpStep } from '../power-up-step/power-up-step.types.ts'

export type OwnerEventType =
  'power_ups.racer_warp_started' | 'power_ups.racer_warp_ended' | 'power_ups.racer_shield_lowered'

export type OwnerEvent = {
  readonly type: OwnerEventType
  readonly racer: number
}

// What runs between a wand's hold phase and its sparks: the beam and its hit test (0x00455100, 0x00455350).
export type WandBeamStep = (step: PowerUpStep) => PowerUpStep
