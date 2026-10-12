import type {
  CinemaSource,
  FrontEndInput,
  RaceCinemaView,
  ScreenCinema,
} from '../../types/front-end.types.ts'
import type { FrontEndWidget } from '../../types/front-end-widget.types.ts'
import type {
  ScreenDefinition,
  ScreenResult,
  ScreenRuntime,
} from '../../types/front-end-screen.types.ts'
import { FrontEndScreen } from '../../types/front-end-screen/front-end-screen.ts'
import { RACE_PREVIEW_SOURCE } from '../race-preview/race-preview.ts'
import { getRacePreviewColourShifts } from '../race-preview/race-preview-effects.ts'
import { createResult, MenuSound } from '../screen-helpers/screen-helpers.ts'
import { getRacePreviewCinemaName } from './race-selection-screens.ts'

// The screens that are one full-screen cinema (MIB item `0x45` over the whole 640 x 480 surface): the cinema file the
// screen's loader names, from the file list of `MENUDATA` (the award, win and introduction folders each hold one `.CDB`).
const CINEMA_SCREEN_SOURCES: ReadonlyMap<number, CinemaSource> = new Map([
  [FrontEndScreen.CIRCUIT_AWARD_ONE, { directory: 'C_AWARD1', fileName: '1STPLACE' }],
  [FrontEndScreen.CIRCUIT_AWARD_TWO, { directory: 'C_AWARD2', fileName: 'TWO' }],
  [FrontEndScreen.CIRCUIT_AWARD_THREE, { directory: 'C_AWARD3', fileName: '3-01' }],
  [FrontEndScreen.CIRCUIT_AWARD_FOUR, { directory: 'C_AWARD4', fileName: 'LOSE' }],
  [FrontEndScreen.WIN_CAR, { directory: 'WINCAR', fileName: 'WINCAR' }],
  [FrontEndScreen.WIN_ROCKET_RACER_CAR, { directory: 'WINRRCAR', fileName: 'END' }],
  [FrontEndScreen.WIN_VV_CAR, { directory: 'WINVVCAR', fileName: 'VVWIN' }],
  [FrontEndScreen.CIRCUIT_ONE_INTRODUCTION, { directory: 'CIRCUIT1', fileName: 'CIR1-01' }],
  [FrontEndScreen.CIRCUIT_ONE_INTRODUCTION + 1, { directory: 'CIRCUIT2', fileName: 'TEST' }],
  [FrontEndScreen.CIRCUIT_ONE_INTRODUCTION + 2, { directory: 'CIRCUIT3', fileName: 'CIR3-01' }],
  [FrontEndScreen.CIRCUIT_ONE_INTRODUCTION + 3, { directory: 'CIRCUIT4', fileName: 'CIR4-01' }],
  [FrontEndScreen.CIRCUIT_ONE_INTRODUCTION + 4, { directory: 'CIRCUIT5', fileName: 'CIR5-01' }],
  [FrontEndScreen.CIRCUIT_ONE_INTRODUCTION + 5, { directory: 'CIRCUIT6', fileName: 'TEST' }],
  [FrontEndScreen.CIRCUIT_SEVEN_INTRODUCTION, { directory: 'CIRCUIT7', fileName: 'FR' }],
])

export const getCinemaScreenSource = (screenId: number): CinemaSource | null =>
  CINEMA_SCREEN_SOURCES.get(screenId) ?? null

// The cinema a screen shows (null on a screen without one): the race of a race select, or the one cinema of a full-screen
// cinema's file.
export const getScreenCinema = (runtime: ScreenRuntime, screenId: number): ScreenCinema | null => {
  const source = getCinemaScreenSource(screenId)
  if (source !== null) {
    const cinema = runtime.resources.getCinemaFiles(source).cinemas.cinemas[0]
    return cinema === undefined ? null : { source, cinemaName: cinema.name }
  }
  const name = getRacePreviewCinemaName(runtime, screenId)
  return name === null ? null : { source: RACE_PREVIEW_SOURCE, cinemaName: name }
}

// What a full-screen cinema asks the viewer to draw: its cinema at the clock the screen has run.
export const getFullScreenCinemaView = (
  runtime: ScreenRuntime,
  screenId: number
): RaceCinemaView | null => {
  const cinema = getScreenCinema(runtime, screenId)
  return cinema === null
    ? null
    : {
        source: cinema.source,
        cinemaName: cinema.cinemaName,
        milliseconds: runtime.racePreview.cinemaMilliseconds,
        partBytes: null,
        emitterPool: runtime.racePreviewEmitters?.pool ?? null,
        colourShifts: getRacePreviewColourShifts(runtime.racePreviewEffects),
      }
}

// The widget of a full-screen cinema: the MIB's `0x45` item, named like the screen's description.
export const getFullScreenCinemaWidgets = (
  runtime: ScreenRuntime,
  screenId: number
): readonly FrontEndWidget[] => [
  {
    kind: 'viewport',
    itemName: runtime.resources.menuNames[screenId] ?? '',
    cinema: getFullScreenCinemaView(runtime, screenId),
  },
]

// Any key leaves a cinema (hypothesis: the original's screens take the same way back; the cinema also ends by itself).
const handleInput = (runtime: ScreenRuntime, input: FrontEndInput): ScreenResult =>
  input === 'accept' || input === 'back'
    ? createResult(runtime, { navigation: { kind: 'pop' }, soundNames: [MenuSound.BACK] })
    : createResult(runtime)

export const createCinemaScreen = (screenId: number): ScreenDefinition =>
  Object.freeze({
    screenId,
    getWidgets: (runtime: ScreenRuntime) => getFullScreenCinemaWidgets(runtime, screenId),
    handleInput,
  })
