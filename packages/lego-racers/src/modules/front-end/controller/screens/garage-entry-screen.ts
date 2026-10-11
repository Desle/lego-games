import { getSaveWithoutRacer } from '../../../save-data/index.ts'
import type { FrontEndInput } from '../../types/front-end.types.ts'
import type { FrontEndWidget } from '../../types/front-end-widget.types.ts'
import { FrontEndScreen } from '../../types/front-end-screen/front-end-screen.ts'
import type { GarageEntry } from '../../types/front-end-screen.types.ts'
import type {
  ScreenDefinition,
  ScreenResult,
  ScreenRuntime,
} from '../../types/front-end-screen.types.ts'
import { getSettingsWithRacer } from '../profile/profile.ts'
import {
  createResult,
  getFocusMoveResult,
  getPageWidgets,
  getPopResult,
  MenuSound,
} from '../screen-helpers/screen-helpers.ts'

// The garage (screen 3, `GARAGE.MIB`: new racer, edit racer, copy, delete, the racer showcase) is ported in part: the page
// shows the racer of the save who plays (left and right choose another), and offers the screens it leads to: the car builder
// (string 0x0b), the driver editor (0x09), a new racer (0x28, `0x00481fe0`) and delete racer (0x2c). **Interim**: the
// original's showcase of the racers' cars and its copy and test drive buttons are not ported.
const ENTRIES: readonly GarageEntry[] = Object.freeze([
  { itemName: 'picka', labelId: 0x0b, targetScreenId: FrontEndScreen.CAR_BUILD },
  { itemName: 'pickb', labelId: 0x09, targetScreenId: FrontEndScreen.EDIT_DRIVER },
  { itemName: 'editlice', labelId: 0x28, targetScreenId: FrontEndScreen.NEW_RACER },
  { itemName: 'delracer', labelId: 0x2c, targetScreenId: null },
  { itemName: 'goback', labelId: 0x1a, targetScreenId: null },
])
const DELETE_FOCUS = 3
const TEXT_STYLE = 'menufont'
const RACER_COLOR = 0xffffffff
const RACER_RECTANGLE = { left: 240, top: 90, right: 630, bottom: 130 }

const getRacerLabel = (runtime: ScreenRuntime): string => {
  const { saveFile, racerIndex, playerCar } = runtime.settings
  const name = (playerCar?.record.name ?? '').toUpperCase()
  return saveFile === null
    ? name
    : `${name}  ${String(racerIndex + 1)}/${String(saveFile.racers.length)}`
}

const getWidgets = (runtime: ScreenRuntime): readonly FrontEndWidget[] => [
  ...getPageWidgets(runtime, FrontEndScreen.GARAGE),
  {
    kind: 'placed_text',
    text: getRacerLabel(runtime),
    styleName: TEXT_STYLE,
    rectangle: RACER_RECTANGLE,
    alignment: 'left',
    color: RACER_COLOR,
  },
  ...ENTRIES.map((entry, index): FrontEndWidget => ({
    kind: 'button',
    itemName: entry.itemName,
    styleName: index === ENTRIES.length - 1 ? 'buttonla' : 'nubutton',
    label: runtime.resources.getMenuText(entry.labelId),
    state: runtime.selection.focusIndex === index ? 'focused' : 'normal',
  })),
]

// Left and right choose another racer of the save; delete takes the chosen racer out (never the last one).
const getRacerResult = (runtime: ScreenRuntime, step: number): ScreenResult => {
  const { saveFile, racerIndex } = runtime.settings
  if (saveFile === null) return createResult(runtime)
  const count = saveFile.racers.length
  const next = (racerIndex + step + count) % count
  return createResult(runtime, {
    settings: getSettingsWithRacer(runtime.resources, runtime.settings, saveFile, next),
    soundNames: [MenuSound.HIGHLIGHT],
  })
}

const getDeleteResult = (runtime: ScreenRuntime): ScreenResult => {
  const { saveFile, racerIndex } = runtime.settings
  if (saveFile === null) return createResult(runtime, { soundNames: [MenuSound.REFUSED] })
  const remaining = getSaveWithoutRacer(saveFile, racerIndex)
  if (remaining === saveFile) return createResult(runtime, { soundNames: [MenuSound.REFUSED] })
  return createResult(runtime, {
    settings: getSettingsWithRacer(
      runtime.resources,
      runtime.settings,
      remaining,
      Math.min(racerIndex, remaining.racers.length - 1)
    ),
    soundNames: [MenuSound.ACCEPT],
  })
}

const handleInput = (runtime: ScreenRuntime, input: FrontEndInput): ScreenResult => {
  const { selection } = runtime
  if (input === 'back') return getPopResult(runtime)
  if (input === 'up' || input === 'down') {
    return getFocusMoveResult(
      runtime,
      input,
      ENTRIES.map(() => false)
    )
  }
  if (input === 'left' || input === 'right')
    return getRacerResult(runtime, input === 'right' ? 1 : -1)
  if (input !== 'accept') return createResult(runtime)
  if (selection.focusIndex === DELETE_FOCUS) return getDeleteResult(runtime)
  const target = ENTRIES[selection.focusIndex]?.targetScreenId ?? null
  return target === null
    ? getPopResult(runtime)
    : createResult(runtime, {
        navigation: { kind: 'push', screenId: target },
        soundNames: [MenuSound.ACCEPT],
      })
}

export const GARAGE_ENTRY_SCREEN: ScreenDefinition = Object.freeze({
  screenId: FrontEndScreen.GARAGE,
  getWidgets,
  handleInput,
})
