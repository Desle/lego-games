import { createEnum } from '../../../../shared/types/enum.types.ts'

// Game settings +0x24 (RaceSession_Begin 0x0042c280, RaceSession_Play 0x0042c330): 0 plays a circuit through
// CircuitRunner_PlayCircuit, anything else runs one race with Race_RunLoop; 2 gives the race a ghost from
// GAMEDATA\COMMON (FUN_00422420).
export const GameMode = createEnum({
  CIRCUIT: 'circuit',
  SINGLE_RACE: 'single_race',
  TIME_TRIAL: 'time_trial',
})

export const GAME_MODE_NUMBERS: Readonly<Record<string, number>> = Object.freeze({
  circuit: 0,
  single_race: 1,
  time_trial: 2,
})

// The races of a circuit sit in four slots (circuit +0x48 + 4 · number).
export const CIRCUIT_SLOT_COUNT = 4

// Settings +0x1c, the menu screen the front end opens after the session: 2 returns to the menu, 3 (settings
// +0x1e bit 2, the countdown skipped) to the garage the race was started from.
export const MENU_RESULT_SCREEN = 2
export const GARAGE_RESULT_SCREEN = 3

// FUN_0042d730 for a demonstration (no local player): six racers, the single race mode and one of the four races of
// the first circuit, picked by the random table (cursor + 1, & 3).
export const DEMONSTRATION_RACER_COUNT = 6
export const DEMONSTRATION_SLOT_MASK = 3
export const DEMONSTRATION_CIRCUIT_NAME = 'c0'

// A time trial has no opponents: the front end sets the racer count to 0 and FUN_0042d730 raises it to the players.
export const TIME_TRIAL_OPPONENT_COUNT = 0
