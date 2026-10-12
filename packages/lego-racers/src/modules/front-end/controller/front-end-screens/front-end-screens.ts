import { FrontEndScreen } from '../../types/front-end-screen/front-end-screen.ts'
import type { FrontEndSelection } from '../../types/front-end.types.ts'
import type { ScreenDefinition, ScreenRuntime } from '../../types/front-end-screen.types.ts'
import { CAR_BUILD_SCREEN } from '../screens/car-build-screen.ts'
import { NEW_RACER_SCREEN } from '../screens/new-racer-screen.ts'
import { DRIVER_EDIT_SCREEN } from '../screens/driver-edit-screen.ts'
import { GARAGE_ENTRY_SCREEN } from '../screens/garage-entry-screen.ts'
import { getUnlockedCircuitMask } from '../profile/profile.ts'
import { MAIN_MENU_SCREEN } from '../screens/main-menu-screen.ts'
import { OPTIONS_SCREEN } from '../screens/options-screen.ts'
import { PICK_RACER_SCREEN } from '../screens/pick-racer-screen.ts'
import {
  CIRCUIT_RACE_SCREEN,
  SINGLE_RACE_SCREEN,
  TIME_TRIAL_SCREEN,
} from '../screens/race-selection-screens.ts'
import { createCinemaScreen, getCinemaScreenSource } from '../screens/cinema-screens.ts'
import { createCircuitResultScreen } from '../screens/circuit-result-screen.ts'
import { createStaticScreen } from '../screens/static-screen.ts'

const IMPLEMENTED_SCREENS: readonly ScreenDefinition[] = Object.freeze([
  MAIN_MENU_SCREEN,
  GARAGE_ENTRY_SCREEN,
  CAR_BUILD_SCREEN,
  NEW_RACER_SCREEN,
  DRIVER_EDIT_SCREEN,
  CIRCUIT_RACE_SCREEN,
  SINGLE_RACE_SCREEN,
  TIME_TRIAL_SCREEN,
  OPTIONS_SCREEN,
  PICK_RACER_SCREEN,
])

// The three racer pick ids share one class in the factory 0x0047f4e0 (cases 0x13, 0x14, 0x15).
const PICK_RACER_IDS: readonly number[] = [
  FrontEndScreen.PICK_RACER,
  FrontEndScreen.PICK_RACER_PLAYER_ONE,
  FrontEndScreen.PICK_RACER_PLAYER_TWO,
]

export const getScreenDefinition = (screenId: number): ScreenDefinition => {
  if (PICK_RACER_IDS.includes(screenId)) return { ...PICK_RACER_SCREEN, screenId }
  if (
    screenId >= FrontEndScreen.CIRCUIT_AWARD_ONE &&
    screenId <= FrontEndScreen.CIRCUIT_AWARD_FOUR
  ) {
    return createCircuitResultScreen(screenId)
  }
  if (getCinemaScreenSource(screenId) !== null) return createCinemaScreen(screenId)
  return (
    IMPLEMENTED_SCREENS.find((screen) => screen.screenId === screenId) ??
    createStaticScreen(screenId)
  )
}

// 0x0046b890: a screen loads the description named by its screen id, except the ones that overwrite the id before
// loading: the time trial and the versus race read SINGRACE (0x00487ca0), the racer picks PICKRCR.
export const getScreenFileName = (screenId: number, menuNames: readonly string[]): string => {
  if (screenId === FrontEndScreen.NEW_RACER) return 'newracer'
  if (screenId === FrontEndScreen.TIME_TRIAL) return 'singrace'
  if (PICK_RACER_IDS.includes(screenId)) return 'pickrcr'
  if (
    screenId === FrontEndScreen.CONTROL_PLAYER_ONE ||
    screenId === FrontEndScreen.CONTROL_PLAYER_TWO
  ) {
    return 'control'
  }
  return menuNames[screenId] ?? ''
}

// The focus a screen starts with (0x00480e10 ... the `+0x4c` calls of each screen's initialiser).
export const getInitialSelection = (
  screenId: number,
  runtime: Omit<ScreenRuntime, 'selection'>
): FrontEndSelection => {
  const base: FrontEndSelection = {
    focusIndex: 0,
    circuitIndex: 0,
    raceIndex: 0,
    racerIndex: 0,
    tabIndex: 0,
    isDialogOpen: false,
    text: '',
  }
  if (PICK_RACER_IDS.includes(screenId)) return { ...base, focusIndex: 1 }
  const isRaceSelection =
    screenId === FrontEndScreen.CIRCUIT_RACE ||
    screenId === FrontEndScreen.SINGLE_RACE ||
    screenId === FrontEndScreen.TIME_TRIAL
  // Circuit 0 is open unless the progression hook says otherwise; a closed one starts on "back".
  if (isRaceSelection && (getUnlockedCircuitMask(runtime) & 1) === 0) {
    return { ...base, focusIndex: 1 }
  }
  return base
}
