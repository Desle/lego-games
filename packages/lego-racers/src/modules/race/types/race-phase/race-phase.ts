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
// `timer < 0x251d` in Race_UpdateState4: a race with a ghost holds at 9,501 ms for the menu (race +0x30c0 = 2).
export const GHOST_MENU_MILLISECONDS = 9501
export const GHOST_MENU_PAUSE_STATE = 2

// The tunes of a race's music list (the first four entries of every LEGOMSC: start, track, lose and win), as
// Race_UpdateState1/2/3 start them through the music stream manager (race +0x3314, slot +0x10).
export const INTRODUCTION_TUNE_INDEX = 0
export const RACING_TUNE_INDEX = 1
export const LOSING_TUNE_INDEX = 2
export const WINNING_TUNE_INDEX = 3
// `4 < count` in Race_UpdateState2: a list with more tunes picks the racing tune by a draw, outside a circuit.
export const RANDOM_RACING_TUNE_MINIMUM_COUNT = 5
export const RANDOM_RACING_TUNE_DIVISOR_OFFSET = 3
// The switch on `draw % (count - 3)`: 1, 2 and 3 select the list's 5th, 6th and 7th entries; the rest keeps tune 1.
export const RANDOM_RACING_TUNES: readonly number[] = Object.freeze([1, 4, 5, 6])
