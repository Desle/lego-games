import { getRacerName, getSaveWithAddedRacer } from '../../../save-data/index.ts'
import type { FrontEndInput } from '../../types/front-end.types.ts'
import type { FrontEndWidget } from '../../types/front-end-widget.types.ts'
import { FrontEndScreen } from '../../types/front-end-screen/front-end-screen.ts'
import type {
  ScreenDefinition,
  ScreenResult,
  ScreenRuntime,
} from '../../types/front-end-screen.types.ts'
import { getBaseCar } from '../driver-base/driver-base.ts'
import { getSettingsWithPlayerCar, getSettingsWithRacer } from '../profile/profile.ts'
import {
  createResult,
  getPageWidgets,
  getPopResult,
  MenuSound,
} from '../screen-helpers/screen-helpers.ts'

// MENUTEXT.SRF: string 1 lists the characters the menu fonts have, string 0x39 is "FIRST NAME".
const CHARACTER_LIST_ID = 1
const FIRST_NAME_LABEL_ID = 0x39
const TEXT_STYLE = 'menufont'
const NAME_COLOR = 0xffffffff
const FIRST_CHARACTER = 'A'
const LABEL_RECTANGLE = { left: 50, top: 170, right: 590, bottom: 210 }
const NAME_RECTANGLE = { left: 50, top: 220, right: 590, bottom: 260 }

// The characters a name may hold: the menu font's, without the leading space.
const getCharacters = (runtime: ScreenRuntime): string =>
  runtime.resources.getMenuText(CHARACTER_LIST_ID).trim()

const getWidgets = (runtime: ScreenRuntime): readonly FrontEndWidget[] => [
  ...getPageWidgets(runtime, FrontEndScreen.NEW_RACER),
  {
    kind: 'placed_text',
    text: runtime.resources.getMenuText(FIRST_NAME_LABEL_ID),
    styleName: TEXT_STYLE,
    rectangle: LABEL_RECTANGLE,
    alignment: 'center',
    color: NAME_COLOR,
  },
  {
    kind: 'placed_text',
    text: runtime.selection.text,
    styleName: TEXT_STYLE,
    rectangle: NAME_RECTANGLE,
    alignment: 'center',
    color: NAME_COLOR,
  },
]

const getTextResult = (runtime: ScreenRuntime, text: string): ScreenResult =>
  createResult(runtime, {
    selection: { ...runtime.selection, text: getRacerName(text) },
    soundNames: [MenuSound.HIGHLIGHT],
  })

// The next or previous character of the list after the last one of the name (a name starts with the first character).
const getCycledText = (runtime: ScreenRuntime, step: number): string => {
  const characters = getCharacters(runtime)
  const { text } = runtime.selection
  if (text === '') return FIRST_CHARACTER
  const last = text.slice(-1)
  const position = characters.indexOf(last)
  const next = characters[(position + step + characters.length) % characters.length] ?? last
  return `${text.slice(0, -1)}${next}`
}

// Leaving with a name: the new racer takes the player's car and driver under it and becomes the player (the garage's "new
// racer", 0x00481fe0), or, without a save, the player's own record takes the name.
const getAcceptResult = (runtime: ScreenRuntime): ScreenResult => {
  const name = runtime.selection.text.trim()
  if (name === '') return createResult(runtime, { soundNames: [MenuSound.REFUSED] })
  const base = getBaseCar(runtime.settings, runtime.resources)
  const record = { ...base.record, name }
  const { saveFile } = runtime.settings
  if (saveFile === null) {
    return createResult(runtime, {
      settings: getSettingsWithPlayerCar(runtime.settings, { ...base, record }),
      navigation: { kind: 'pop' },
      soundNames: [MenuSound.ACCEPT],
    })
  }
  const added = getSaveWithAddedRacer(saveFile, record)
  if (added === saveFile) return createResult(runtime, { soundNames: [MenuSound.REFUSED] })
  return createResult(runtime, {
    settings: getSettingsWithRacer(
      runtime.resources,
      runtime.settings,
      added,
      added.racers.length - 1
    ),
    navigation: { kind: 'pop' },
    soundNames: [MenuSound.ACCEPT],
  })
}

const handleInput = (runtime: ScreenRuntime, input: FrontEndInput): ScreenResult => {
  switch (input) {
    case 'up':
      return getTextResult(runtime, getCycledText(runtime, 1))
    case 'down':
      return getTextResult(runtime, getCycledText(runtime, -1))
    case 'right':
      return runtime.selection.text === ''
        ? createResult(runtime)
        : getTextResult(runtime, `${runtime.selection.text}${FIRST_CHARACTER}`)
    case 'left':
      return getTextResult(runtime, runtime.selection.text.slice(0, -1))
    case 'accept':
      return getAcceptResult(runtime)
    case 'back':
      return getPopResult(runtime)
    default:
      return createResult(runtime)
  }
}

export const NEW_RACER_SCREEN: ScreenDefinition = Object.freeze({
  screenId: FrontEndScreen.NEW_RACER,
  getWidgets,
  handleInput,
})
