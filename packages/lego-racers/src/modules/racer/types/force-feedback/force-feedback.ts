import type { ForceFeedbackEffect } from '../racer.types.ts'

const RESTART_STATE = 2

// 0x004220e0 (strength 150) and 0x00422100 (strength 100, only when idle): the effect restarts with that strength
// and duration; 0x00421f30 sets the state to 2 and the elapsed time to 0. Without a device nothing happens.
export const getRestartedForceFeedback = (
  effect: ForceFeedbackEffect,
  strength: number
): ForceFeedbackEffect =>
  effect.isPresent
    ? Object.freeze({
        ...effect,
        phase: 0,
        strength,
        duration: strength,
        state: RESTART_STATE,
        elapsed: 0,
      })
    : effect
