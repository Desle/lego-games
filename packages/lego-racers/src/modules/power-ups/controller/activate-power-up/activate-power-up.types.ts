import type { EffectState } from '../../types/power-ups.types.ts'

// The aim chosen when a projectile is used: a racer index or a track (TGB) point index.
export type ActivationTarget = {
  readonly racer: number | null
  readonly trackTarget: number | null
}

export type EffectStart = {
  readonly state: EffectState
  readonly timerMilliseconds: number
  readonly level: number
  readonly ownerRacer: number | null
  readonly targetRacer: number | null
  readonly targetTrackPoint: number | null
  readonly rocketIndex: number
}
