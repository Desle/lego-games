import { getRacerShowcaseView } from '../racer-showcase/racer-showcase.ts'
import { getCircuitIntroductionScreenId } from './circuit-introduction-screen.ts'
import type { FrontEndInput } from '../../types/front-end.types.ts'
import type { FrontEndWidget } from '../../types/front-end-widget.types.ts'
import { FrontEndScreen, FrontEndText } from '../../types/front-end-screen/front-end-screen.ts'
import type {
  ScreenDefinition,
  ScreenResult,
  ScreenRuntime,
} from '../../types/front-end-screen.types.ts'
import {
  createResult,
  getClampedStep,
  getThreeWidgetFocusResult,
  MenuSound,
} from '../screen-helpers/screen-helpers.ts'

// The racer the menus pick when the player has built none (the garage and the save files are another module).
export const DEFAULT_PLAYER_RACER_NAME = 'PLAYER 1'
const VERSUS_PLAYER_COUNT = 2

const CONFIGURATION_INDEX = 0
const CONFIRM_INDEX = 1
const BACK_INDEX = 2

const getRacerNames = (runtime: ScreenRuntime): readonly string[] =>
  runtime.environment.playerRacerNames.length === 0
    ? [DEFAULT_PLAYER_RACER_NAME]
    : runtime.environment.playerRacerNames

// 0x00484f40: the players picked so far; the versus race asks for a second racer after the first.
const getPickedPlayerCount = (runtime: ScreenRuntime): number =>
  runtime.settings.playerRacerNames.length

const getIsLastPlayer = (runtime: ScreenRuntime): boolean =>
  !runtime.settings.isVersus || getPickedPlayerCount(runtime) + 1 >= VERSUS_PLAYER_COUNT

const getTitleId = (runtime: ScreenRuntime): number =>
  runtime.settings.isVersus
    ? FrontEndText.PLAYER_ONE_RACER_SELECT + getPickedPlayerCount(runtime)
    : FrontEndText.RACER_SELECT

const getWidgets = (runtime: ScreenRuntime): readonly FrontEndWidget[] => {
  const { resources, selection } = runtime
  const names = getRacerNames(runtime)
  const isLast = getIsLastPlayer(runtime)
  const state = (index: number) => (selection.focusIndex === index ? 'focused' : 'normal')
  return [
    { kind: 'image', itemName: 'backdrp', imageName: 'backdrp' },
    {
      kind: 'text',
      itemName: 'banner',
      text: resources.getMenuText(getTitleId(runtime)),
      styleName: 'banner',
      alignment: 'left',
    },
    { kind: 'frame', itemName: 'bluebox', rectangleItemName: 'rcont' },
    {
      kind: 'text',
      itemName: 'rcont',
      text: names[selection.racerIndex] ?? '',
      styleName: 'menufont',
      alignment: 'center',
    },
    { kind: 'viewport', itemName: 'showcase', showcase: getRacerShowcaseView(runtime.showcase) },
    {
      kind: 'button',
      itemName: 'control',
      styleName: 'nubutton',
      label: resources.getMenuText(FrontEndText.CONFIGURATION),
      state: state(CONFIGURATION_INDEX),
    },
    {
      kind: 'button',
      itemName: isLast ? 'gorace' : 'gonext',
      styleName: 'buttonch',
      label: resources.getMenuText(FrontEndText.OK),
      state: state(CONFIRM_INDEX),
    },
    {
      kind: 'button',
      itemName: 'goback',
      styleName: 'buttonca',
      label: resources.getMenuText(FrontEndText.CANCEL),
      state: state(BACK_INDEX),
    },
  ]
}

// 0x004850a0 case 0x41: the racer count is the opponents the menus chose plus the players; a circuit race with one
// player has five opponents, a versus race has none, a time trial has none.
const getRacerCount = (runtime: ScreenRuntime, playerCount: number): number => {
  const { settings } = runtime
  if (settings.isVersus) return playerCount
  if (settings.mode === 'circuit') return 5 + playerCount
  if (settings.mode === 'time_trial') return playerCount
  return settings.racerCount + playerCount
}

const handleInput = (runtime: ScreenRuntime, input: FrontEndInput): ScreenResult => {
  const { selection, settings } = runtime
  const names = getRacerNames(runtime)
  if (input === 'up' || input === 'down') {
    return getThreeWidgetFocusResult(runtime, input)
  }
  if (input === 'left' || input === 'right') {
    const racerIndex = getClampedStep(selection.racerIndex, input, names.length - 1)
    return createResult(runtime, {
      selection: { ...selection, racerIndex },
      soundNames: racerIndex === selection.racerIndex ? [] : [MenuSound.HIGHLIGHT],
    })
  }
  const isBack = input === 'back' || selection.focusIndex === BACK_INDEX
  if (isBack) {
    const picked = settings.playerRacerNames
    return createResult(runtime, {
      navigation: { kind: 'pop' },
      settings: { ...settings, playerRacerNames: picked.slice(0, Math.max(0, picked.length - 1)) },
      soundNames: [MenuSound.BACK],
    })
  }
  if (selection.focusIndex === CONFIGURATION_INDEX) {
    return createResult(runtime, { soundNames: [MenuSound.REFUSED] })
  }
  const playerRacerNames = [...settings.playerRacerNames, names[selection.racerIndex] ?? '']
  if (!getIsLastPlayer(runtime)) {
    return createResult(runtime, {
      settings: { ...settings, playerRacerNames },
      navigation: { kind: 'push', screenId: FrontEndScreen.PICK_RACER_PLAYER_TWO },
      soundNames: [MenuSound.ACCEPT],
    })
  }
  const playerCount = playerRacerNames.length
  // 0x004850a0 case 0x41: a circuit race with one player first shows the circuit's introduction, which starts the race
  // when it is done; anything else starts the race at once.
  const isIntroduced = settings.mode === 'circuit' && playerCount === 1
  return createResult(runtime, {
    settings: {
      ...settings,
      playerRacerNames,
      localPlayerCount: playerCount,
      racerCount: getRacerCount(runtime, playerCount),
    },
    navigation: isIntroduced
      ? { kind: 'push', screenId: getCircuitIntroductionScreenId(runtime) }
      : { kind: 'race' },
    soundNames: [MenuSound.ACCEPT],
  })
}

export const PICK_RACER_SCREEN: ScreenDefinition = Object.freeze({
  screenId: FrontEndScreen.PICK_RACER,
  getWidgets,
  handleInput,
})
