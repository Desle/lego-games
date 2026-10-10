import { createEnum } from '../../../../shared/types/enum.types.ts'

// The five timed states of Race_RunLoop 0x00432540 (race +0x3328, 1..5); each has its own function.
export const RacePhase = createEnum({
  // 1, Race_UpdateState1 0x004349a0: the introduction, 2,000 ms.
  INTRODUCTION: 'introduction',
  // 2, Race_UpdateState2 0x00434b00: the countdown, 3,000 ms.
  COUNTDOWN: 'countdown',
  // 3, Race_UpdateState3 0x00434c80: racing until a human racer finishes.
  RACING: 'racing',
  // 4, Race_UpdateState4 0x00434eb0: the others finish, at most 10,000 ms.
  FINISHING: 'finishing',
  // 5, Race_UpdateState5 0x00435180: the results; the loop ends.
  RESULTS: 'results',
})

// The state number the original stores at race +0x3328.
export const RACE_PHASE_STATE_NUMBERS = Object.freeze({
  [RacePhase.INTRODUCTION]: 1,
  [RacePhase.COUNTDOWN]: 2,
  [RacePhase.RACING]: 3,
  [RacePhase.FINISHING]: 4,
  [RacePhase.RESULTS]: 5,
})

// The comparisons of the state functions against the state timer (race +0x332c, unsigned milliseconds).
// `1999 < timer` at 0x004349f4.
export const INTRODUCTION_MILLISECONDS = 2000
// `2999 < timer` at 0x00434b0c.
export const COUNTDOWN_MILLISECONDS = 3000
// `9999 < timer` at 0x00434f4b.
export const FINISHING_MILLISECONDS = 10000
// Set by Race_UpdateState3 when race +0x335c is non-zero.
export const SKIPPED_COUNTDOWN_FINISHING_START_MILLISECONDS = 9000
// `4000 < timer` and `timer < 5000` in Race_UpdateState5 only matter with the points record (race +0x18).
export const RESULTS_MILLISECONDS = 5000
