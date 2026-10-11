import {
  DRIVER_PARTS,
  getDriverChoice,
  getDriverSessionPartBytes,
  mixDriver,
  moveDriverChooser,
} from '../../../figure-builder/index.ts'
import type { DriverPartValue, DriverSession } from '../../../figure-builder/index.ts'
import type { FrontEndInput, FrontEndRectangle } from '../../types/front-end.types.ts'
import type { FrontEndWidget } from '../../types/front-end-widget.types.ts'
import { FrontEndScreen } from '../../types/front-end-screen/front-end-screen.ts'
import type {
  ScreenDefinition,
  ScreenResult,
  ScreenRuntime,
} from '../../types/front-end-screen.types.ts'
import { getSettingsWithPlayerCar } from '../profile/profile.ts'
import { getBaseCar } from '../driver-base/driver-base.ts'
import { findEntry, getAbsoluteRectangle } from '../screen-layout/screen-layout.ts'
import {
  createResult,
  getFocusMoveResult,
  getPopResult,
  MenuSound,
} from '../screen-helpers/screen-helpers.ts'

const SCREEN_NAME = 'editdrvr'
const TEXT_STYLE = 'menufont'
const BUTTON_STYLE = 'nubutton'
const LABEL_COLOR = 0xffffffff
// 0x0047d2f0: the four choosers, then mix (string 0x38), next and back.
const CHOOSER_ITEM_NAMES: Readonly<Record<DriverPartValue, string>> = Object.freeze({
  hat: 'hatsel',
  face: 'facesel',
  torso: 'torsosel',
  legs: 'legsel',
})
const MIX_FOCUS = DRIVER_PARTS.length
const NEXT_FOCUS = MIX_FOCUS + 1
const BACK_FOCUS = NEXT_FOCUS + 1
const FOCUS_COUNT = BACK_FOCUS + 1
const MIX_LABEL_ID = 0x38
const NEXT_LABEL_ID = 0x1c
const BACK_LABEL_ID = 0x1a
const TITLE_LABEL_ID = 0x09
const ARROW_SIZE = 32
const CHOOSER_ARROW_OFFSET = 232
const CHOOSER_ARROW_TOP = 16
// The expression byte shares its byte with a top bit the editor leaves alone (0x0042b330 masks it off).
const EXPRESSION_TOP_BIT = 0x80
const NO_DRIVER_PARTS: readonly DriverPartValue[] = DRIVER_PARTS

const getChooserRectangle = (runtime: ScreenRuntime, part: DriverPartValue): FrontEndRectangle => {
  const files = runtime.resources.getScreenFiles(SCREEN_NAME)
  const entry = files === null ? null : findEntry(files.description, CHOOSER_ITEM_NAMES[part])
  if (files === null || entry === null) return { left: 0, top: 0, right: 0, bottom: 0 }
  return getAbsoluteRectangle(files.description, entry, { width: 0, height: 0 })
}

// The name the catalogue gives a part: the hat's, the head's prefix, the torso's or the legs' material name.
const getPartName = (runtime: ScreenRuntime, part: DriverPartValue, index: number): string => {
  const catalog = runtime.resources.getDriverCatalog()
  switch (part) {
    case 'hat':
      return catalog.hats[index]?.name ?? ''
    case 'face':
      return catalog.heads.entries[index]?.name ?? ''
    case 'torso':
      return catalog.torsos.entries[index]?.name ?? ''
    case 'legs':
      return catalog.legs.entries[index]?.name ?? ''
  }
}

const getChooserWidgets = (
  runtime: ScreenRuntime,
  driver: DriverSession,
  part: DriverPartValue,
  isFocused: boolean
): FrontEndWidget[] => {
  const rectangle = getChooserRectangle(runtime, part)
  const { indices, position } = driver[part]
  // The menu fonts have no underscore: the catalogue's names show with spaces.
  const name = getPartName(runtime, part, getDriverChoice(driver, part))
    .toUpperCase()
    .replaceAll('_', ' ')
  const top = rectangle.top + CHOOSER_ARROW_TOP
  return [
    {
      kind: 'placed_image',
      imageName: isFocused ? 'arrowla' : 'arrowlu',
      rectangle: {
        left: rectangle.left,
        top,
        right: rectangle.left + ARROW_SIZE,
        bottom: top + ARROW_SIZE,
      },
    },
    {
      kind: 'placed_text',
      text: `${name}  ${String(position + 1)}/${String(indices.length)}`,
      styleName: TEXT_STYLE,
      rectangle: {
        left: rectangle.left + ARROW_SIZE,
        top,
        right: rectangle.left + CHOOSER_ARROW_OFFSET,
        bottom: top + ARROW_SIZE,
      },
      alignment: 'center',
      color: LABEL_COLOR,
    },
    {
      kind: 'placed_image',
      imageName: isFocused ? 'arrowra' : 'arrowru',
      rectangle: {
        left: rectangle.left + CHOOSER_ARROW_OFFSET,
        top,
        right: rectangle.left + CHOOSER_ARROW_OFFSET + ARROW_SIZE,
        bottom: top + ARROW_SIZE,
      },
    },
  ]
}

const getButtonWidget = (
  runtime: ScreenRuntime,
  itemName: string,
  labelId: number,
  isFocused: boolean
): FrontEndWidget => ({
  kind: 'button',
  itemName,
  styleName: BUTTON_STYLE,
  label: runtime.resources.getMenuText(labelId),
  state: isFocused ? 'focused' : 'normal',
})

// 0x0047ce30 .. 0x0047d2f0: the title, the four choosers, the buttons mix, next and back, and the platform with the driver.
const getWidgets = (runtime: ScreenRuntime): readonly FrontEndWidget[] => {
  const { driver, selection } = runtime
  if (driver === null) return [{ kind: 'image', itemName: 'backdrp', imageName: 'backdrp' }]
  return [
    { kind: 'image', itemName: 'backdrp', imageName: 'backdrp' },
    {
      kind: 'text',
      itemName: 'banner',
      text: runtime.resources.getMenuText(TITLE_LABEL_ID),
      styleName: 'banner',
      alignment: 'left',
    },
    ...NO_DRIVER_PARTS.flatMap((part, index) =>
      getChooserWidgets(runtime, driver, part, selection.focusIndex === index)
    ),
    getButtonWidget(runtime, 'mix', MIX_LABEL_ID, selection.focusIndex === MIX_FOCUS),
    getButtonWidget(runtime, 'gonext', NEXT_LABEL_ID, selection.focusIndex === NEXT_FOCUS),
    getButtonWidget(runtime, 'goback', BACK_LABEL_ID, selection.focusIndex === BACK_FOCUS),
    {
      kind: 'viewport',
      itemName: 'platform',
      driver: { partBytes: getDriverSessionPartBytes(driver) },
    },
  ]
}

// 0x0047dbf0 (next): the parts go into the racer's record, bytes +0x1c .. +0x20 (face, hat, legs, torso, expression).
const getApplyResult = (runtime: ScreenRuntime, driver: DriverSession): ScreenResult => {
  const base = getBaseCar(runtime.settings, runtime.resources)
  const [hat = 0, face = 0, torso = 0, legs = 0, expression = 0] = getDriverSessionPartBytes(driver)
  const topBit = (base.record.colorBytes[4] ?? 0) & EXPRESSION_TOP_BIT
  return createResult(runtime, {
    settings: getSettingsWithPlayerCar(runtime.settings, {
      ...base,
      record: { ...base.record, colorBytes: [face, hat, legs, torso, expression | topBit] },
    }),
    navigation: { kind: 'pop' },
    soundNames: [MenuSound.ACCEPT],
  })
}

const handleInput = (runtime: ScreenRuntime, input: FrontEndInput): ScreenResult => {
  const { driver, selection } = runtime
  if (driver === null) return createResult(runtime)
  if (input === 'back') {
    return getPopResult(runtime)
  }
  if (input === 'up' || input === 'down') {
    return getFocusMoveResult(
      runtime,
      input,
      Array.from({ length: FOCUS_COUNT }, () => false)
    )
  }
  const focusedPart = NO_DRIVER_PARTS[selection.focusIndex]
  if ((input === 'left' || input === 'right') && focusedPart !== undefined) {
    return createResult(runtime, {
      driver: moveDriverChooser(driver, focusedPart, input === 'right' ? 1 : -1),
      soundNames: [MenuSound.HIGHLIGHT],
    })
  }
  if (input !== 'accept') return createResult(runtime)
  if (selection.focusIndex === MIX_FOCUS) {
    const mixed = mixDriver(
      driver,
      runtime.environment.randomTable,
      runtime.settings.randomPosition
    )
    return createResult(runtime, {
      driver: mixed.session,
      settings: { ...runtime.settings, randomPosition: mixed.randomPosition },
      soundNames: [MenuSound.ACCEPT],
    })
  }
  if (selection.focusIndex === NEXT_FOCUS) return getApplyResult(runtime, driver)
  if (selection.focusIndex === BACK_FOCUS) {
    return getPopResult(runtime)
  }
  return createResult(runtime)
}

export const DRIVER_EDIT_SCREEN: ScreenDefinition = Object.freeze({
  screenId: FrontEndScreen.EDIT_DRIVER,
  getWidgets,
  handleInput,
})
