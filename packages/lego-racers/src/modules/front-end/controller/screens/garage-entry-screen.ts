import type { FrontEndInput } from '../../types/front-end.types.ts'
import type { FrontEndWidget } from '../../types/front-end-widget.types.ts'
import { FrontEndScreen } from '../../types/front-end-screen/front-end-screen.ts'
import type { GarageEntry } from '../../types/front-end-screen.types.ts'
import type {
  ScreenDefinition,
  ScreenResult,
  ScreenRuntime,
} from '../../types/front-end-screen.types.ts'
import {
  createResult,
  getFocusMoveResult,
  getPopResult,
  getPageWidgets,
  MenuSound,
} from '../screen-helpers/screen-helpers.ts'

// The garage (screen 3, `GARAGE.MIB`: new racer, edit racer, copy, delete, the racer showcase) is not ported yet. Until it
// is, the build button of the main menu opens this page, which offers the two screens the garage leads to: the car
// builder (string 0x0b) and the driver editor (string 0x09). **Interim**, not the original's flow.
const ENTRIES: readonly GarageEntry[] = Object.freeze([
  { itemName: 'picka', labelId: 0x0b, targetScreenId: FrontEndScreen.CAR_BUILD },
  { itemName: 'pickb', labelId: 0x09, targetScreenId: FrontEndScreen.EDIT_DRIVER },
  { itemName: 'goback', labelId: 0x1a, targetScreenId: null },
])
const BACK_FOCUS = ENTRIES.length - 1

const getWidgets = (runtime: ScreenRuntime): readonly FrontEndWidget[] => [
  ...getPageWidgets(runtime, FrontEndScreen.GARAGE),
  ...ENTRIES.map((entry, index): FrontEndWidget => ({
    kind: 'button',
    itemName: entry.itemName,
    styleName: index === BACK_FOCUS ? 'buttonla' : 'nubutton',
    label: runtime.resources.getMenuText(entry.labelId),
    state: runtime.selection.focusIndex === index ? 'focused' : 'normal',
  })),
]

const handleInput = (runtime: ScreenRuntime, input: FrontEndInput): ScreenResult => {
  const { selection } = runtime
  if (input === 'back') {
    return getPopResult(runtime)
  }
  if (input === 'up' || input === 'down') {
    return getFocusMoveResult(
      runtime,
      input,
      ENTRIES.map(() => false)
    )
  }
  if (input !== 'accept') return createResult(runtime)
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
