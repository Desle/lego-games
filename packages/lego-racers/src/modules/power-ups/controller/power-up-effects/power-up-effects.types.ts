import type { PowerUpEffectKind } from '../../types/power-ups.types.ts'
import type { PowerUpStep } from '../power-up-step/power-up-step.types.ts'

// 0x0045b2e0's search: the class, and up to four levels (-1 matches none).
export type EffectTakeRequest = {
  readonly kind: PowerUpEffectKind
  readonly levels: readonly number[]
}

export type EffectTakeResult = {
  readonly step: PowerUpStep
  readonly effectId: number
}

export type StealCandidate = {
  readonly effectId: number | null
  readonly state: number
  readonly timer: number
}

// 0x0045b9e0 for an object other than an effect.
export type AttachmentSlotAllocation = {
  readonly step: PowerUpStep
  readonly slotIndex: number | null
}
