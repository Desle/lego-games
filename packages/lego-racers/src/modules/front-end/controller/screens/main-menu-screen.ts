import { getUnlockedCircuitRunLength } from '../../../save-data/index.ts'
import {
  MAIN_MENU_FIGURE_DRIVER_INDICES,
  MAIN_MENU_FIGURE_FORWARD,
  MAIN_MENU_FIGURE_POSITION,
} from '../../types/menu-figure/menu-figure.ts'
import type { DriverPreview, FrontEndInput } from '../../types/front-end.types.ts'
import type { FrontEndWidget } from '../../types/front-end-widget.types.ts'
import { FrontEndScreen, FrontEndText } from '../../types/front-end-screen/front-end-screen.ts'
import type { MainMenuButton } from '../../types/front-end-screen.types.ts'
import type {
  ScreenDefinition,
  ScreenResult,
  ScreenRuntime,
} from '../../types/front-end-screen.types.ts'
import {
  createResult,
  getFirstEnabledIndex,
  getFocusMoveResult,
  MenuSound,
} from '../screen-helpers/screen-helpers.ts'

// 0x00480f20: the buttons in the order the original creates them, with the label strings and the targets of 0x00481150.
const BUTTONS: readonly MainMenuButton[] = Object.freeze([
  {
    itemName: 'garage',
    labelId: FrontEndText.BUILD,
    targetScreenId: FrontEndScreen.GARAGE,
    versusFlag: 'keep',
  },
  {
    itemName: 'circuit',
    labelId: 0x21,
    targetScreenId: FrontEndScreen.CIRCUIT_RACE,
    versusFlag: 'clear',
  },
  {
    itemName: 'single',
    labelId: 0x22,
    targetScreenId: FrontEndScreen.SINGLE_RACE,
    versusFlag: 'clear',
  },
  { itemName: 'vs', labelId: 0x23, targetScreenId: FrontEndScreen.SINGLE_RACE, versusFlag: 'set' },
  {
    itemName: 'time',
    labelId: 0x24,
    targetScreenId: FrontEndScreen.TIME_TRIAL,
    versusFlag: 'keep',
  },
  {
    itemName: 'options',
    labelId: FrontEndText.OPTIONS,
    targetScreenId: FrontEndScreen.OPTIONS,
    versusFlag: 'keep',
  },
  { itemName: 'quit', labelId: FrontEndText.QUIT, targetScreenId: 0, versusFlag: 'keep' },
])

// 0x00481000: the figure of the platform is the driver `DAT_004c214c[run]` shows (see MAIN_MENU_FIGURE_DRIVER_INDICES).
const getFigure = (runtime: ScreenRuntime): DriverPreview | null => {
  const { saveFile } = runtime.settings
  const run = saveFile === null ? 0 : getUnlockedCircuitRunLength(saveFile.profile)
  const index = MAIN_MENU_FIGURE_DRIVER_INDICES[run] ?? MAIN_MENU_FIGURE_DRIVER_INDICES[0] ?? 0
  const driver = runtime.resources.getDriverDatabase().drivers[index]
  if (driver === undefined) return null
  return {
    partBytes: driver.unreadBytes,
    position: MAIN_MENU_FIGURE_POSITION,
    forward: MAIN_MENU_FIGURE_FORWARD,
  }
}

const MENU_FONT_STYLE = 'menufont'
const FOCUSED_COLOR = 0xff03fe09
const IDLE_COLOR = 0xff4b4b4b
const DIALOG_FRAME_IMAGES = ['tul', 'tt', 'tur', 'tr', 'tbr', 'tb', 'tbl', 'tl']
const DIALOG_FRAME = Object.freeze({ left: 144, top: 170, right: 496, bottom: 310 })
const DIALOG_CHOICE_COUNT = 2

// 0x00480f20: the "vs" button is disabled when the input manager counts no controller (`+0x98` of it is zero).
const getDisabledFlags = (runtime: ScreenRuntime): readonly boolean[] =>
  BUTTONS.map((button) => button.versusFlag === 'set' && runtime.environment.controllerCount === 0)

const getDialogWidgets = (runtime: ScreenRuntime): readonly FrontEndWidget[] => {
  const { resources, selection } = runtime
  const choices = [FrontEndText.YES, FrontEndText.NO]
  return [
    { kind: 'fill', itemName: 'dimmer' },
    {
      kind: 'placed_frame',
      rectangle: DIALOG_FRAME,
      imageNames: DIALOG_FRAME_IMAGES,
      color: 0xff191add,
      bottomColor: 0xff000037,
    },
    {
      kind: 'placed_text',
      text: resources.getMenuText(FrontEndText.QUIT_QUESTION),
      styleName: MENU_FONT_STYLE,
      rectangle: { left: 160, top: 196, right: 480, bottom: 240 },
      alignment: 'center',
      color: 0xffffffff,
    },
    ...choices.map((textId, index): FrontEndWidget => ({
      kind: 'placed_text',
      text: resources.getMenuText(textId),
      styleName: MENU_FONT_STYLE,
      rectangle: { left: 200 + index * 160, top: 262, right: 280 + index * 160, bottom: 294 },
      alignment: 'left',
      color: selection.focusIndex === index ? FOCUSED_COLOR : IDLE_COLOR,
    })),
  ]
}

const getWidgets = (runtime: ScreenRuntime): readonly FrontEndWidget[] => {
  const disabled = getDisabledFlags(runtime)
  const widgets: FrontEndWidget[] = [
    { kind: 'image', itemName: 'backdrp', imageName: 'backdrp' },
    { kind: 'image', itemName: 'racers', imageName: 'racers' },
    { kind: 'viewport', itemName: 'platform', driver: getFigure(runtime) },
    ...BUTTONS.map((button, index): FrontEndWidget => ({
      kind: 'button',
      itemName: button.itemName,
      styleName: 'nubutton',
      label: runtime.resources.getMenuText(button.labelId),
      state:
        disabled[index] === true
          ? 'disabled'
          : !runtime.selection.isDialogOpen && runtime.selection.focusIndex === index
            ? 'focused'
            : 'normal',
    })),
  ]
  return runtime.selection.isDialogOpen ? [...widgets, ...getDialogWidgets(runtime)] : widgets
}

const handleDialogInput = (runtime: ScreenRuntime, input: FrontEndInput): ScreenResult => {
  const { selection } = runtime
  if (input === 'accept') {
    if (selection.focusIndex === 0) {
      return createResult(runtime, { navigation: { kind: 'quit' }, soundNames: [MenuSound.ACCEPT] })
    }
    return createResult(runtime, {
      selection: { ...selection, isDialogOpen: false, focusIndex: BUTTONS.length - 1 },
      soundNames: [MenuSound.BACK],
    })
  }
  if (input === 'back') {
    return createResult(runtime, {
      selection: { ...selection, isDialogOpen: false, focusIndex: BUTTONS.length - 1 },
      soundNames: [MenuSound.BACK],
    })
  }
  const step = input === 'left' || input === 'up' ? -1 : 1
  const focusIndex = Math.min(DIALOG_CHOICE_COUNT - 1, Math.max(0, selection.focusIndex + step))
  return createResult(runtime, {
    selection: { ...selection, focusIndex },
    soundNames: focusIndex === selection.focusIndex ? [] : [MenuSound.HIGHLIGHT],
  })
}

// 0x00481150 and 0x004812c0: the button chosen sets the screen to open; "vs" also sets the versus flag
// (frontend `+0x4bb8` bit 2) and "quit" asks the question first (the dialog of 0x00481150's last branch).
const handleInput = (runtime: ScreenRuntime, input: FrontEndInput): ScreenResult => {
  const { selection, settings } = runtime
  if (selection.isDialogOpen) return handleDialogInput(runtime, input)
  const disabled = getDisabledFlags(runtime)
  if (input === 'up' || input === 'down') {
    return getFocusMoveResult(runtime, input, disabled)
  }
  if (input !== 'accept') return createResult(runtime)
  const button = BUTTONS[selection.focusIndex]
  if (button === undefined || disabled[selection.focusIndex] === true) {
    return createResult(runtime, { soundNames: [MenuSound.REFUSED] })
  }
  if (button.targetScreenId === 0) {
    return createResult(runtime, {
      selection: { ...selection, isDialogOpen: true, focusIndex: 1 },
      soundNames: [MenuSound.ACCEPT],
    })
  }
  return createResult(runtime, {
    settings: {
      ...settings,
      isVersus: button.versusFlag === 'keep' ? settings.isVersus : button.versusFlag === 'set',
    },
    navigation: { kind: 'push', screenId: button.targetScreenId },
    soundNames: [MenuSound.ACCEPT],
  })
}

export const MAIN_MENU_SCREEN: ScreenDefinition = Object.freeze({
  screenId: FrontEndScreen.MAIN_MENU,
  getWidgets,
  handleInput,
})

export { getFirstEnabledIndex as getInitialMainMenuFocus }
