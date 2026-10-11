import type { Circuit } from '../../../circuit-database/index.ts'
import type { RaceCatalogEntry } from '../../../race-catalog/index.ts'
import type {
  FrontEndInput,
  FrontEndRaceSlot,
  FrontEndResources,
  FrontEndSettings,
} from '../../types/front-end.types.ts'
import type { FrontEndWidget } from '../../types/front-end-widget.types.ts'
import {
  CIRCUIT_IMAGE_NAMES,
  FrontEndScreen,
  FrontEndText,
} from '../../types/front-end-screen/front-end-screen.ts'
import type {
  ScreenDefinition,
  ScreenResult,
  ScreenRuntime,
} from '../../types/front-end-screen.types.ts'
import { createResult, getClampedStep, MenuSound } from '../screen-helpers/screen-helpers.ts'

const RACES_PER_CIRCUIT = 4
// 0x0047a3f0: the circuit race screen shows the next race of the circuit every 2,000 ms.
const RACE_CYCLE_MILLISECONDS = 2000
const GONEXT_INDEX = 0
const GOBACK_INDEX = 1
const SELECTOR_RECTANGLE = Object.freeze({ left: 3, top: 29, right: 220, bottom: 72 })
const LOGO_WIDTH = 150

export type RaceSelectionKind = 'circuit_race' | 'single_race' | 'time_trial'

const getCircuit = (resources: FrontEndResources, index: number): Circuit | null =>
  resources.circuits.circuits[index] ?? null

// RaceCatalog_Load 0x004366f0 stores each race at its circuit's `+0x48 + 4 · number`.
export const getCircuitRaceEntries = (
  resources: FrontEndResources,
  circuitName: string
): readonly (RaceCatalogEntry | null)[] =>
  Array.from(
    { length: RACES_PER_CIRCUIT },
    (_, number) =>
      resources.races.entries.find(
        (entry) => entry.circuitName === circuitName && entry.raceNumber === number
      ) ?? null
  )

const getRaceSlot = (entry: RaceCatalogEntry): FrontEndRaceSlot =>
  Object.freeze({
    raceName: entry.name,
    raceFolder: entry.firstName,
    isRaceFlagged: entry.isFlagged,
  })

const getAvailableRaces = (
  resources: FrontEndResources,
  circuitName: string
): readonly RaceCatalogEntry[] =>
  getCircuitRaceEntries(resources, circuitName).filter(
    (entry): entry is RaceCatalogEntry => entry !== null
  )

const getTitleId = (kind: RaceSelectionKind, isVersus: boolean): number => {
  if (kind === 'circuit_race') return FrontEndText.CIRCUIT_RACE
  if (kind === 'time_trial') return FrontEndText.TIME_RACE
  return isVersus ? FrontEndText.VERSUS_RACE : FrontEndText.SINGLE_RACE
}

const getIsCircuitLocked = (runtime: ScreenRuntime): boolean =>
  ((runtime.environment.unlockedCircuitMask >> runtime.selection.circuitIndex) & 1) === 0

const getRaceNumberWithinCycle = (
  resources: FrontEndResources,
  runtime: ScreenRuntime,
  screenMilliseconds: number
): number => {
  const circuit = getCircuit(resources, runtime.selection.circuitIndex)
  const count = circuit === null ? 0 : getAvailableRaces(resources, circuit.name).length
  return count === 0 || runtime.selection.circuitIndex === 6
    ? 0
    : Math.floor(screenMilliseconds / RACE_CYCLE_MILLISECONDS) % count
}

// The sections of SINGRACE.MIB / CIRCRACE.MIB the two screens share: the backdrop, the title, the circuit selector and
// its arrows, the frame of the preview, the buttons.
const getCommonWidgets = (runtime: ScreenRuntime, kind: RaceSelectionKind): FrontEndWidget[] => {
  const { resources, selection, settings } = runtime
  const circuitCount = resources.circuits.circuits.length
  const logoName = CIRCUIT_IMAGE_NAMES[selection.circuitIndex] ?? ''
  const selectorLeft = SELECTOR_RECTANGLE.left
  const selectorTop = SELECTOR_RECTANGLE.top
  const isLocked = getIsCircuitLocked(runtime)
  const widgets: FrontEndWidget[] = [
    { kind: 'image', itemName: 'backdrp', imageName: 'backdrp' },
    {
      kind: 'text',
      itemName: 'banner',
      text: resources.getMenuText(getTitleId(kind, settings.isVersus)),
      styleName: 'banner',
      alignment: 'left',
    },
    { kind: 'frame', itemName: 'brickbox' },
    {
      kind: 'placed_image',
      imageName: logoName,
      rectangle: {
        left: selectorLeft + Math.floor((SELECTOR_RECTANGLE.right - selectorLeft - LOGO_WIDTH) / 2),
        top: selectorTop,
        right:
          selectorLeft + Math.floor((SELECTOR_RECTANGLE.right - selectorLeft + LOGO_WIDTH) / 2),
        bottom: selectorTop + 43,
      },
    },
  ]
  if (selection.circuitIndex > 0) {
    widgets.push({
      kind: 'placed_image',
      imageName: 'arrowla',
      rectangle: {
        left: selectorLeft,
        top: selectorTop + 6,
        right: selectorLeft + 32,
        bottom: selectorTop + 38,
      },
    })
  }
  if (selection.circuitIndex < circuitCount - 1) {
    widgets.push({
      kind: 'placed_image',
      imageName: 'arrowra',
      rectangle: {
        left: selectorLeft + 188,
        top: selectorTop + 6,
        right: selectorLeft + 220,
        bottom: selectorTop + 38,
      },
    })
  }
  widgets.push(
    { kind: 'viewport', itemName: 'singrace' },
    {
      kind: 'button',
      itemName: 'gonext',
      styleName: 'buttonch',
      label: resources.getMenuText(FrontEndText.OK),
      state: isLocked ? 'disabled' : selection.focusIndex === GONEXT_INDEX ? 'focused' : 'normal',
    },
    {
      kind: 'button',
      itemName: 'goback',
      styleName: 'buttonla',
      label: resources.getMenuText(FrontEndText.MAIN_MENU),
      state: selection.focusIndex === GOBACK_INDEX ? 'focused' : 'normal',
    }
  )
  return widgets
}

const getCircuitRaceWidgets = (runtime: ScreenRuntime): readonly FrontEndWidget[] => {
  const { resources, selection } = runtime
  const circuit = getCircuit(resources, selection.circuitIndex)
  const races = circuit === null ? [] : getAvailableRaces(resources, circuit.name)
  const raceEntry = races[getRaceNumberWithinCycle(resources, runtime, runtime.screenMilliseconds)]
  const text = (itemName: string, value: string): FrontEndWidget => ({
    kind: 'text',
    itemName,
    text: value,
    styleName: 'menufont',
    alignment: 'center',
  })
  return [
    ...getCommonWidgets(runtime, 'circuit_race'),
    text('hosting', resources.getMenuText(FrontEndText.HOSTING_CHAMPION)),
    text('champtxt', resources.getMenuText(FrontEndText.FIRST_CHAMPION + selection.circuitIndex)),
    text('circtext', resources.getMenuText(FrontEndText.CIRCUIT_NUMBER)),
    text('numbtext', resources.getMenuText(FrontEndText.FIRST_DIGIT + 1 + selection.circuitIndex)),
    text(
      'racename',
      raceEntry === undefined ? '' : resources.getCircuitText(raceEntry.shortNumber)
    ),
  ]
}

const getSingleRaceWidgets =
  (kind: RaceSelectionKind) =>
  (runtime: ScreenRuntime): readonly FrontEndWidget[] => {
    const { resources, selection } = runtime
    const circuit = getCircuit(resources, selection.circuitIndex)
    const races = circuit === null ? [] : getAvailableRaces(resources, circuit.name)
    const raceEntry = races[selection.raceIndex]
    const widgets = getCommonWidgets(runtime, kind)
    widgets.push({
      kind: 'text',
      itemName: 'racesel',
      text: raceEntry === undefined ? '' : resources.getCircuitText(raceEntry.shortNumber),
      styleName: 'menufont',
      alignment: 'center',
    })
    if (kind === 'time_trial') {
      const none = resources.getMenuText(FrontEndText.NONE)
      widgets.push(
        {
          kind: 'text',
          itemName: 'besttype',
          text: resources.getMenuText(FrontEndText.BEST_LAP_TIME),
          styleName: 'tinyfont',
          alignment: 'left',
        },
        {
          kind: 'text',
          itemName: 'bestname',
          text: none,
          styleName: 'tinyfont',
          alignment: 'left',
        },
        { kind: 'text', itemName: 'besttime', text: none, styleName: 'tinyfont', alignment: 'left' }
      )
    }
    return widgets
  }

const getSettingsForCircuit = (
  runtime: ScreenRuntime,
  mode: FrontEndSettings['mode'],
  raceIndex: number
): FrontEndSettings => {
  const { resources, selection, settings } = runtime
  const circuit = getCircuit(resources, selection.circuitIndex)
  if (circuit === null) return settings
  const entries = getCircuitRaceEntries(resources, circuit.name)
  const chosen = entries[raceIndex] ?? entries.find((entry) => entry !== null) ?? null
  const races = entries
    .filter((entry): entry is RaceCatalogEntry => entry !== null)
    .map(getRaceSlot)
  return {
    ...settings,
    mode,
    circuitName: circuit.name,
    circuitRaces: races,
    raceName: chosen?.name ?? '',
    raceFolder: chosen?.firstName ?? '',
    isRaceFlagged: chosen?.isFlagged ?? false,
  }
}

const handleInput =
  (kind: RaceSelectionKind) =>
  (runtime: ScreenRuntime, input: FrontEndInput): ScreenResult => {
    const { resources, selection } = runtime
    const circuitCount = resources.circuits.circuits.length
    if (input === 'up' || input === 'down') {
      const focusIndex = input === 'up' ? GONEXT_INDEX : GOBACK_INDEX
      return createResult(runtime, {
        selection: { ...selection, focusIndex },
        soundNames: focusIndex === selection.focusIndex ? [] : [MenuSound.HIGHLIGHT],
      })
    }
    if (input === 'left' || input === 'right') {
      const circuitIndex = getClampedStep(selection.circuitIndex, input, circuitCount - 1)
      return createResult(runtime, {
        selection: {
          ...selection,
          circuitIndex,
          raceIndex: 0,
          // 0x0047a0e0: a closed circuit disables "next" and moves the focus to "back".
          focusIndex:
            ((runtime.environment.unlockedCircuitMask >> circuitIndex) & 1) === 0
              ? GOBACK_INDEX
              : selection.focusIndex,
        },
        soundNames: circuitIndex === selection.circuitIndex ? [] : [MenuSound.HIGHLIGHT],
      })
    }
    if (input === 'back' || selection.focusIndex === GOBACK_INDEX) {
      return createResult(runtime, {
        navigation: { kind: 'pop' },
        settings: { ...runtime.settings, isVersus: false },
        soundNames: [MenuSound.BACK],
      })
    }
    if (getIsCircuitLocked(runtime))
      return createResult(runtime, { soundNames: [MenuSound.REFUSED] })
    // 0x00487d40 and 0x00487f90: "next" copies the circuit and the race into the settings, sets the mode and opens
    // the racer pick; the race screen's own `racerCount` choice stays.
    const mode =
      kind === 'circuit_race' ? 'circuit' : kind === 'time_trial' ? 'time_trial' : 'single_race'
    const settings = getSettingsForCircuit(runtime, mode, selection.raceIndex)
    return createResult(runtime, {
      settings: mode === 'time_trial' ? { ...settings, racerCount: 0 } : settings,
      navigation: { kind: 'push', screenId: FrontEndScreen.PICK_RACER },
      soundNames: [MenuSound.ACCEPT],
    })
  }

export const CIRCUIT_RACE_SCREEN: ScreenDefinition = Object.freeze({
  screenId: FrontEndScreen.CIRCUIT_RACE,
  getWidgets: getCircuitRaceWidgets,
  handleInput: handleInput('circuit_race'),
})

export const SINGLE_RACE_SCREEN: ScreenDefinition = Object.freeze({
  screenId: FrontEndScreen.SINGLE_RACE,
  getWidgets: getSingleRaceWidgets('single_race'),
  handleInput: handleInput('single_race'),
})

export const TIME_TRIAL_SCREEN: ScreenDefinition = Object.freeze({
  screenId: FrontEndScreen.TIME_TRIAL,
  getWidgets: getSingleRaceWidgets('time_trial'),
  handleInput: handleInput('time_trial'),
})
