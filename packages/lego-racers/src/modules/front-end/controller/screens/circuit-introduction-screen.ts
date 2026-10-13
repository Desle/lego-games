import type { FrontEndInput } from '../../types/front-end.types.ts'
import type {
  ScreenDefinition,
  ScreenResult,
  ScreenRuntime,
} from '../../types/front-end-screen.types.ts'
import { FrontEndScreen } from '../../types/front-end-screen/front-end-screen.ts'
import { createResult } from '../screen-helpers/screen-helpers.ts'
import { getFullScreenCinemaWidgets } from './cinema-screens.ts'

export const getIsCircuitIntroductionScreen = (screenId: number): boolean =>
  screenId >= FrontEndScreen.CIRCUIT_ONE_INTRODUCTION &&
  screenId <= FrontEndScreen.CIRCUIT_SEVEN_INTRODUCTION

// The circuit introduction the racer pick opens for a circuit race with one player (0x004850a0 case 0x41): 0x1f plus
// the circuit's index in the circuit database (0x0041f400 gives 0 for a name it does not hold).
export const getCircuitIntroductionScreenId = (runtime: ScreenRuntime): number =>
  FrontEndScreen.CIRCUIT_ONE_INTRODUCTION +
  Math.max(
    0,
    runtime.resources.circuits.circuits.findIndex(
      (circuit) => circuit.name === runtime.settings.circuitName
    )
  )

// The cinema is done (it ended, or a key ended it: the front end hands the screen `accept` then): the screen's way out
// (0x00479d10 for circuits 1 to 6, 0x00476a00 for the seventh, both with the front end still running) pops it and ends
// the front end, so the circuit's first race starts.
const handleInput = (runtime: ScreenRuntime, input: FrontEndInput): ScreenResult =>
  input === 'accept'
    ? createResult(runtime, { navigation: { kind: 'race' } })
    : createResult(runtime)

// Circuits 1 to 6 have their own class (0x00479a80); the seventh is drawn by the award class (0x00475c30). Both show the
// circuit's cinema over the whole screen.
export const createCircuitIntroductionScreen = (screenId: number): ScreenDefinition =>
  Object.freeze({
    screenId,
    getWidgets: (runtime: ScreenRuntime) => getFullScreenCinemaWidgets(runtime, screenId),
    handleInput,
  })
