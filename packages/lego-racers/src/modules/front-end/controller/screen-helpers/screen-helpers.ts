import type {
  FrontEndInput,
  FrontEndSelection,
  FrontEndSettings,
} from '../../types/front-end.types.ts'
import type { ScreenResult, ScreenRuntime } from '../../types/front-end-screen.types.ts'

// MENUDATA\SOUNDS files. The original plays them by the ids of GENC0R0.SBK through 0x0046e970 and the style's sound
// table; which file each event plays is this port's reading (hypothesis), taken from the file names.
export const MenuSound = Object.freeze({
  HIGHLIGHT: 'hilight1',
  ACCEPT: 'ok',
  BACK: 'cancel',
  REFUSED: 'cantdo2',
})

export const DEFAULT_OPPONENT_COUNT = 5
export const DEFAULT_LAP_COUNT = 3
export const MAXIMUM_OPPONENT_COUNT = 5
export const MAXIMUM_LAP_COUNT = 8

export const createFrontEndSettings = (): FrontEndSettings =>
  Object.freeze({
    mode: 'single_race',
    isVersus: false,
    circuitName: '',
    raceName: '',
    raceFolder: '',
    isRaceFlagged: false,
    circuitRaces: Object.freeze([]),
    racerCount: DEFAULT_OPPONENT_COUNT,
    lapCount: DEFAULT_LAP_COUNT,
    localPlayerCount: 1,
    playerRacerNames: Object.freeze([]),
  })

export const createSelection = (): FrontEndSelection =>
  Object.freeze({
    focusIndex: 0,
    circuitIndex: 0,
    raceIndex: 0,
    racerIndex: 0,
    tabIndex: 0,
    isDialogOpen: false,
  })

export const createResult = (
  runtime: ScreenRuntime,
  changes: Partial<ScreenResult> = {}
): ScreenResult => ({
  selection: runtime.selection,
  settings: runtime.settings,
  navigation: { kind: 'none' },
  soundNames: [],
  ...changes,
})

// The focus moves to the next widget that is not disabled, and stays at the end of the list.
export const getMovedFocusIndex = (
  focusIndex: number,
  isDisabled: readonly boolean[],
  input: FrontEndInput
): number => {
  const step = input === 'up' ? -1 : 1
  for (let index = focusIndex + step; index >= 0 && index < isDisabled.length; index += step) {
    if (isDisabled[index] !== true) return index
  }
  return focusIndex
}

export const getFirstEnabledIndex = (isDisabled: readonly boolean[]): number =>
  Math.max(
    0,
    isDisabled.findIndex((isEntryDisabled) => !isEntryDisabled)
  )

export const getClampedStep = (value: number, input: FrontEndInput, maximum: number): number =>
  Math.min(maximum, Math.max(0, value + (input === 'right' ? 1 : -1)))
