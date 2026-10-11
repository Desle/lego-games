import type {
  FrontEndInput,
  FrontEndSelection,
  FrontEndSettings,
} from '../../types/front-end.types.ts'
import type { FrontEndWidget } from '../../types/front-end-widget.types.ts'
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
    playerCar: null,
    randomPosition: 0,
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
  builder: runtime.builder,
  driver: runtime.driver,
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

// Up and down move the focus over three always-enabled widgets, with the highlight sound when it moved.
export const getThreeWidgetFocusResult = (
  runtime: ScreenRuntime,
  input: FrontEndInput
): ScreenResult => {
  const { selection } = runtime
  const focusIndex = getMovedFocusIndex(selection.focusIndex, [false, false, false], input)
  return createResult(runtime, {
    selection: { ...selection, focusIndex },
    soundNames: focusIndex === selection.focusIndex ? [] : [MenuSound.HIGHLIGHT],
  })
}

// The page of a screen this port does not run in full: its backdrop and its name.
export const getPageWidgets = (
  runtime: ScreenRuntime,
  screenId: number
): readonly FrontEndWidget[] => [
  { kind: 'image', itemName: 'backdrp', imageName: 'backdrp' },
  {
    kind: 'text',
    itemName: 'banner',
    text: (runtime.resources.menuNames[screenId] ?? '').toUpperCase(),
    styleName: 'banner',
    alignment: 'left',
  },
]

// Up and down move the focus to the next widget that is not disabled, with the highlight sound when it moved.
export const getFocusMoveResult = (
  runtime: ScreenRuntime,
  input: FrontEndInput,
  isDisabled: readonly boolean[]
): ScreenResult => {
  const { selection } = runtime
  const focusIndex = getMovedFocusIndex(selection.focusIndex, isDisabled, input)
  return createResult(runtime, {
    selection: { ...selection, focusIndex },
    soundNames: focusIndex === selection.focusIndex ? [] : [MenuSound.HIGHLIGHT],
  })
}

// Leaving the screen for the one below it, with the way-back sound.
export const getPopResult = (runtime: ScreenRuntime): ScreenResult =>
  createResult(runtime, { navigation: { kind: 'pop' }, soundNames: [MenuSound.BACK] })
