import type { FrontEndInput } from '@lego-games/lego-racers/front-end'
import { HookKind } from './hd-coverage.types.ts'
import type {
  FrontEndPlace,
  HdCoveragePlace,
  OnScreenPlace,
  RacePlace,
} from './hd-coverage.types.ts'

// The menus take keys once they have opened (the pixel trace's keys: frame 250 of the original, 96 steps after the menu opened),
// one every 20 steps.
const FIRST_KEY_STEP = 96
const KEY_SPACING_STEPS = 20
const SETTLED_STEPS = 60
const LATER_STEPS = 200
const TIME_TRIAL_FOLDER = 'RACEC0R0'
// Well after the countdown (about 90 frames): the sliding player's dust and tire smoke are behind it, in front of the camera.
const ON_SCREEN_SLIDE_FRAME = 200
const RACE_FRAME_COUNT = 300
const RACE_RECORD_FRAMES: readonly number[] = [120, 290]
const ON_SCREEN_RACE_FRAME = 120

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
  isBestRunShown: boolean,
  isPlayerSliding = false
): RacePlace => ({
  kind: 'race',
  name,
  mode,
  raceFolder: TIME_TRIAL_FOLDER,
  isPlayerSliding,
  racerCount,
  localPlayerCount,
  isBestRunShown,
  frameCount: RACE_FRAME_COUNT,
  recordFrames: RACE_RECORD_FRAMES,
})

// A place's first recorded frame (a race's `raceFrame`), drawn again without each of the layer's drawings.
const getOnScreenPlace = (
  subject: FrontEndPlace | RacePlace,
  expectedHooks: readonly HookKind[],
  raceFrame = ON_SCREEN_RACE_FRAME
): OnScreenPlace => ({
  kind: 'on_screen',
  name: `On screen: ${subject.name}`,
  subject:
    subject.kind === 'front_end'
      ? { ...subject, recordSteps: subject.recordSteps.slice(0, 1) }
      : {
          ...subject,
          frameCount: raceFrame + 1,
          recordFrames: [raceFrame],
        },
  expectedHooks,
})

// Every place the game draws a racer: the menus' figures and cars, the cinemas, and the races of every mode; and a race whose
// frame has particles, which must reach the screen as the layer's parts.
export const HD_COVERAGE_PLACES: readonly HdCoveragePlace[] = [
  { kind: 'model_parts', name: 'Every model of the folder, part by part' },
  { kind: 'driver_seats', name: 'Every driver on its seat' },
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
  getOnScreenPlace(getMenuPlace('Main menu figure', null, []), [HookKind.DRIVER]),
  getOnScreenPlace(getMenuPlace('Car builder', 0x0e, []), [HookKind.CAR]),
  getOnScreenPlace(getRacePlace('Race start', 'single_race', 6, 1, false), [
    HookKind.CAR,
    HookKind.DRIVER,
  ]),
  getOnScreenPlace(
    getRacePlace('Power slide', 'single_race', 6, 1, false, true),
    [HookKind.CAR, HookKind.DRIVER, HookKind.PARTICLE],
    ON_SCREEN_SLIDE_FRAME
  ),
]
