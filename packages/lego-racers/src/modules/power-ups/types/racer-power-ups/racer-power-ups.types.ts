import type { RacerPowerUps, RandomState } from '../power-ups.types.ts'

export type VoiceResult = {
  readonly racer: RacerPowerUps
  readonly random: RandomState
  // The sound index passed to 0x00443b80, or null when none plays.
  readonly voiceSound: number | null
}

export type EnhancementCollectResult = VoiceResult & {
  readonly isAccepted: boolean
}

export type EnhancementDropResult = {
  readonly racer: RacerPowerUps
  readonly droppedBrickIndex: number | null
}

export type EnhancementReleaseResult = {
  readonly racer: RacerPowerUps
  readonly releasedBrickIndices: readonly number[]
}
