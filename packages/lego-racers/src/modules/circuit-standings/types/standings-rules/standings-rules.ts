import { createEnum } from '../../../../shared/types/enum.types.ts'

// The table at 0x004b0b58 that FUN_004402c0 indexes with a racer's place (0 is first): 30, 20, 10, 3, 2, 1.
export const POINTS_BY_PLACE: readonly number[] = Object.freeze([30, 20, 10, 3, 2, 1])

// The points record holds six racers (arrays of six dwords at +0x10 and +0x28).
export const STANDINGS_RACER_COUNT = 6

// A circuit has four race slots (CircuitRunner_PlayCircuit loops `i < 4`).
export const CIRCUIT_RACE_COUNT = 4

// PlayCircuit: with one local player, racer 0 needs `raceIndex · 10` points before race `raceIndex` starts.
export const POINTS_REQUIRED_PER_RACE = 10

// The menu screen the circuit ends on (settings +0x1c): 0x16, 0x17 and 0x18 for the first three places and 0x19 for
// nobody on the podium (the front end's FUN_004767b0 records the place and the unlocks for the first three).
export const CircuitResultScreen = createEnum({
  FIRST_PLACE: 'first_place',
  SECOND_PLACE: 'second_place',
  THIRD_PLACE: 'third_place',
  NO_PLACE: 'no_place',
})

export const CIRCUIT_RESULT_SCREEN_NUMBERS: Readonly<Record<string, number>> = Object.freeze({
  first_place: 0x16,
  second_place: 0x17,
  third_place: 0x18,
  no_place: 0x19,
})
