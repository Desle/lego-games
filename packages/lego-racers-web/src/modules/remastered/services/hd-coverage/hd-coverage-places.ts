import type { FrontEndInput } from '@lego-games/lego-racers/front-end'
import type { FrontEndPlace, HdCoveragePlace, RacePlace } from './hd-coverage.types.ts'

// The menus take keys once they have opened (the pixel trace's keys: frame 250 of the original, 96 steps after the menu opened),
// one every 20 steps.
const FIRST_KEY_STEP = 96
const KEY_SPACING_STEPS = 20
const SETTLED_STEPS = 60
const LATER_STEPS = 200
const TIME_TRIAL_FOLDER = 'RACEC0R0'
const RACE_FRAME_COUNT = 300
const RACE_RECORD_FRAMES: readonly number[] = [120, 290]

// The seven circuits' introduction cinemas (`CIRCUIT1` .. `CIRCUIT7`, screens 0x1f to 0x25).
const CIRCUIT_INTRODUCTION_SCREEN_IDS: readonly number[] = [
  0x1f, 0x20, 0x21, 0x22, 0x23, 0x24, 0x25,
]

const getKeyInputs = (keys: readonly FrontEndInput[]): readonly (FrontEndInput | null)[] => {
  const steps = new Map(keys.map((key, index) => [FIRST_KEY_STEP + KEY_SPACING_STEPS * index, key]))
  const length = FIRST_KEY_STEP + KEY_SPACING_STEPS * keys.length
  return Array.from({ length }, (_, step) => steps.get(step + 1) ?? null)
}

// A menu reached from the main menu with keys, or a screen the front end opens on, censused after it has settled.
const getMenuPlace = (
  name: string,
  firstScreenId: number | null,
  keys: readonly FrontEndInput[]
): FrontEndPlace => {
  const lastKeyStep = keys.length === 0 ? 0 : FIRST_KEY_STEP + KEY_SPACING_STEPS * keys.length
  return {
    kind: 'front_end',
    name,
    firstScreenId,
    inputs: getKeyInputs(keys),
    recordSteps: [lastKeyStep + SETTLED_STEPS, lastKeyStep + LATER_STEPS],
  }
}

const getRacePlace = (
  name: string,
  mode: RacePlace['mode'],
  racerCount: number,
  localPlayerCount: number,
  isBestRunShown: boolean
): RacePlace => ({
  kind: 'race',
  name,
  mode,
  raceFolder: TIME_TRIAL_FOLDER,
  racerCount,
  localPlayerCount,
  isBestRunShown,
  frameCount: RACE_FRAME_COUNT,
  recordFrames: RACE_RECORD_FRAMES,
})

// Every place the game draws a racer: the menus' figures and cars, the cinemas, and the races of every mode.
export const HD_COVERAGE_PLACES: readonly HdCoveragePlace[] = [
  getMenuPlace('Main menu figure', null, []),
  getMenuPlace('Circuit racer select', null, ['down', 'accept', 'accept']),
  getMenuPlace('Single race select', null, ['down', 'down', 'accept']),
  getMenuPlace('Single race racer select', null, ['down', 'down', 'accept', 'accept']),
  getMenuPlace('Time trial select', null, ['down', 'down', 'down', 'accept']),
  getMenuPlace('Time trial racer select', null, ['down', 'down', 'down', 'accept', 'accept']),
  getMenuPlace('Garage, car builder', null, ['accept', 'accept']),
  getMenuPlace('Garage, driver editor', null, ['accept', 'down', 'accept']),
  getMenuPlace('Driver editor', 0x0f, []),
  getMenuPlace('Car builder', 0x0e, []),
  getMenuPlace('Versus racer select', 0x14, []),
  ...CIRCUIT_INTRODUCTION_SCREEN_IDS.map((screenId, index) =>
    getMenuPlace(`Circuit ${String(index + 1)} introduction cinema`, screenId, [])
  ),
  getMenuPlace('First place award cinema', 0x16, []),
  getMenuPlace('Second place award cinema', 0x17, []),
  getMenuPlace('Third place award cinema', 0x18, []),
  getMenuPlace('Lost circuit cinema', 0x19, []),
  getMenuPlace('Winning car cinema', 0x1a, []),
  getMenuPlace('Rocket Racer car won cinema', 0x1b, []),
  getMenuPlace('Veronica Voltage car won cinema', 0x1c, []),
  getRacePlace('Single race, player and five computers', 'single_race', 6, 1, false),
  getRacePlace('Circuit, first race', 'circuit', 6, 1, false),
  getRacePlace('Versus, two players', 'single_race', 2, 2, false),
  getRacePlace('Time trial, champion ghost', 'time_trial', 1, 1, false),
  getRacePlace('Time trial, champion and best run ghosts', 'time_trial', 1, 1, true),
]
