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
  getMovedFocusIndex,
  MAXIMUM_LAP_COUNT,
  MAXIMUM_OPPONENT_COUNT,
  MenuSound,
} from '../screen-helpers/screen-helpers.ts'

type OptionsButton = {
  readonly itemName: string
  readonly labelId: number
  // The tab the button opens (0x004832d0 sets 0x369 of the screen) or the screen it pushes.
  readonly tabIndex: number | null
  readonly targetScreenId: number | null
}

const MENU_TAB = 0
const GAME_TAB = 1

// 0x00475730 and 0x004832d0: the buttons of OPTIONS.MIB and what each opens.
const BUTTONS: readonly OptionsButton[] = Object.freeze([
  { itemName: 'game', labelId: 0x11, tabIndex: GAME_TAB, targetScreenId: null },
  { itemName: 'video', labelId: 0x12, tabIndex: 2, targetScreenId: null },
  { itemName: 'audio', labelId: 0x13, tabIndex: 3, targetScreenId: null },
  {
    itemName: 'player1',
    labelId: 0x56,
    tabIndex: null,
    targetScreenId: FrontEndScreen.CONTROL_PLAYER_ONE,
  },
  {
    itemName: 'player2',
    labelId: 0x57,
    tabIndex: null,
    targetScreenId: FrontEndScreen.CONTROL_PLAYER_TWO,
  },
  {
    itemName: 'language',
    labelId: 0x9c,
    tabIndex: null,
    targetScreenId: FrontEndScreen.PICK_LANGUAGE,
  },
  { itemName: 'credits', labelId: 0x58, tabIndex: null, targetScreenId: FrontEndScreen.CREDITS },
  { itemName: 'goback', labelId: FrontEndText.MAIN_MENU, tabIndex: null, targetScreenId: null },
])
const BACK_INDEX = BUTTONS.length - 1
// The game tab's focus: the opponents chooser, the laps chooser, back.
const GAME_FOCUS_COUNT = 3
const OPPONENTS_FOCUS = 0
const LAPS_FOCUS = 1

const getButtonState = (runtime: ScreenRuntime, index: number) =>
  runtime.selection.focusIndex === index ? 'focused' : 'normal'

const getGameTabWidgets = (runtime: ScreenRuntime): readonly FrontEndWidget[] => {
  const { resources, selection, settings } = runtime
  const state = (index: number) => (selection.focusIndex === index ? 'focused' : 'normal')
  return [
    {
      kind: 'text',
      itemName: 'chmptext',
      text: resources.getMenuText(FrontEndText.OPPONENT_COUNT_LABEL),
      styleName: 'menufont',
      alignment: 'left',
    },
    {
      kind: 'text',
      itemName: 'chmpcont',
      text: String(settings.racerCount),
      styleName: 'menufont',
      alignment: 'center',
    },
    {
      kind: 'text',
      itemName: 'laptext',
      text: resources.getMenuText(FrontEndText.LAP_COUNT_LABEL),
      styleName: 'menufont',
      alignment: 'left',
    },
    {
      kind: 'text',
      itemName: 'lapcont',
      text: String(settings.lapCount),
      styleName: 'menufont',
      alignment: 'center',
    },
    {
      kind: 'button',
      itemName: 'goback',
      styleName: 'buttonla',
      label: resources.getMenuText(FrontEndText.BACK),
      state: state(2),
    },
  ]
}

const getWidgets = (runtime: ScreenRuntime): readonly FrontEndWidget[] => {
  const { resources, selection } = runtime
  const widgets: FrontEndWidget[] = [
    { kind: 'image', itemName: 'backdrp', imageName: 'backdrp' },
    {
      kind: 'text',
      itemName: 'banner',
      text: resources.getMenuText(FrontEndText.OPTIONS_TITLE),
      styleName: 'banner',
      alignment: 'left',
    },
  ]
  if (selection.tabIndex === GAME_TAB) return [...widgets, ...getGameTabWidgets(runtime)]
  return [
    ...widgets,
    ...BUTTONS.map((button, index): FrontEndWidget => ({
      kind: 'button',
      itemName: button.itemName,
      styleName: index === BACK_INDEX ? 'buttonla' : 'nubutton',
      label: resources.getMenuText(button.labelId),
      state: getButtonState(runtime, index),
    })),
  ]
}

const handleGameTabInput = (runtime: ScreenRuntime, input: FrontEndInput): ScreenResult => {
  const { selection, settings } = runtime
  if (input === 'back' || (input === 'accept' && selection.focusIndex === GAME_FOCUS_COUNT - 1)) {
    return createResult(runtime, {
      selection: { ...selection, tabIndex: MENU_TAB, focusIndex: 0 },
      soundNames: [MenuSound.BACK],
    })
  }
  if (input === 'up' || input === 'down') {
    const focusIndex = getMovedFocusIndex(selection.focusIndex, [false, false, false], input)
    return createResult(runtime, {
      selection: { ...selection, focusIndex },
      soundNames: focusIndex === selection.focusIndex ? [] : [MenuSound.HIGHLIGHT],
    })
  }
  if (input !== 'left' && input !== 'right') return createResult(runtime)
  const step = input === 'right' ? 1 : -1
  // 0x004833e0: the chooser at +0x1bc8 writes `+0x100` (the opponents), the one at +0x25bc writes `+0x2c` (the laps).
  if (selection.focusIndex === OPPONENTS_FOCUS) {
    const racerCount = Math.min(MAXIMUM_OPPONENT_COUNT, Math.max(0, settings.racerCount + step))
    return createResult(runtime, {
      settings: { ...settings, racerCount },
      soundNames: racerCount === settings.racerCount ? [] : [MenuSound.HIGHLIGHT],
    })
  }
  if (selection.focusIndex === LAPS_FOCUS) {
    const lapCount = Math.min(MAXIMUM_LAP_COUNT, Math.max(1, settings.lapCount + step))
    return createResult(runtime, {
      settings: { ...settings, lapCount },
      soundNames: lapCount === settings.lapCount ? [] : [MenuSound.HIGHLIGHT],
    })
  }
  return createResult(runtime)
}

const handleInput = (runtime: ScreenRuntime, input: FrontEndInput): ScreenResult => {
  const { selection } = runtime
  if (selection.tabIndex === GAME_TAB) return handleGameTabInput(runtime, input)
  if (selection.tabIndex !== MENU_TAB) {
    return input === 'accept' || input === 'back'
      ? createResult(runtime, {
          selection: { ...selection, tabIndex: MENU_TAB, focusIndex: 0 },
          soundNames: [MenuSound.BACK],
        })
      : createResult(runtime)
  }
  if (input === 'up' || input === 'down') {
    const focusIndex = getMovedFocusIndex(
      selection.focusIndex,
      BUTTONS.map(() => false),
      input
    )
    return createResult(runtime, {
      selection: { ...selection, focusIndex },
      soundNames: focusIndex === selection.focusIndex ? [] : [MenuSound.HIGHLIGHT],
    })
  }
  if (input === 'back') {
    return createResult(runtime, { navigation: { kind: 'pop' }, soundNames: [MenuSound.BACK] })
  }
  if (input !== 'accept') return createResult(runtime)
  const button = BUTTONS[selection.focusIndex]
  if (button === undefined) return createResult(runtime)
  if (selection.focusIndex === BACK_INDEX) {
    return createResult(runtime, { navigation: { kind: 'pop' }, soundNames: [MenuSound.BACK] })
  }
  if (button.targetScreenId !== null) {
    return createResult(runtime, {
      navigation: { kind: 'push', screenId: button.targetScreenId },
      soundNames: [MenuSound.ACCEPT],
    })
  }
  return createResult(runtime, {
    selection: { ...selection, tabIndex: button.tabIndex ?? MENU_TAB, focusIndex: 0 },
    soundNames: [MenuSound.ACCEPT],
  })
}

export const OPTIONS_SCREEN: ScreenDefinition = Object.freeze({
  screenId: FrontEndScreen.OPTIONS,
  getWidgets,
  handleInput,
})
