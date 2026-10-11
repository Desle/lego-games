import {
  createBuilderSession,
  getDirectionXStep,
  getDirectionYStep,
  getBuilderPreviewDesign,
  moveBuilderSession,
  placeBuilderBrick,
  raiseBuilderCamera,
  rotateBuilderSession,
  selectBuilderPiece,
  selectBuilderSet,
  serializeCarDesign,
  turnBuilderCamera,
  undoBuilderBrick,
} from '../../../car-builder/index.ts'
import type { BuilderSession } from '../../../car-builder/index.ts'
import type { FrontEndInput, FrontEndRectangle } from '../../types/front-end.types.ts'
import type { FrontEndWidget } from '../../types/front-end-widget.types.ts'
import { FrontEndScreen } from '../../types/front-end-screen/front-end-screen.ts'
import type {
  ScreenDefinition,
  ScreenResult,
  ScreenRuntime,
} from '../../types/front-end-screen.types.ts'
import {
  findEntry,
  getAbsoluteRectangle,
  getPropertyValues,
} from '../screen-layout/screen-layout.ts'
import { createResult, MenuSound } from '../screen-helpers/screen-helpers.ts'

const SCREEN_NAME = 'carbuild'
const TEXT_STYLE = 'menufont'
const LABEL_COLOR = 0xffffffff
// The directions the numeric keypad names (0x00473ee0): key 8 is index 0, key 6 index 2, key 2 index 4, key 4 index 6.
const DIRECTION_INDICES: Readonly<Partial<Record<FrontEndInput, number>>> = Object.freeze({
  up: 0,
  right: 2,
  down: 4,
  left: 6,
})
// The arrows of the choosers (images `arrowlu` .. `arrowra` of the menu images) are 32 pixels wide.
const SET_IMAGE_STYLES: readonly string[] = Object.freeze([
  'pirate',
  'alien',
  'bricks',
  'castle',
  'islander',
  'magical',
  'jungle',
  'adventur',
  'space',
  'race',
  'rr',
  'vv',
])
const CHOOSER_ARROW_SIZE = 32

const getRectangle = (
  runtime: ScreenRuntime,
  itemName: string,
  width = 0,
  height = 0
): FrontEndRectangle => {
  const files = runtime.resources.getScreenFiles(SCREEN_NAME)
  const entry = files === null ? null : findEntry(files.description, itemName)
  if (files === null || entry === null) return { left: 0, top: 0, right: 0, bottom: 0 }
  return getAbsoluteRectangle(files.description, entry, { width, height })
}

// The style image a set shows (MSB `0x32` styles, one per set in the order of the sets: **hypothesis** for the order, which
// holds for the last two sets, `rr` and `vv`).
const getSetImageName = (runtime: ScreenRuntime, setIndex: number): string => {
  const styleName = SET_IMAGE_STYLES[setIndex] ?? ''
  const files = runtime.resources.getScreenFiles(SCREEN_NAME)
  const style = files?.styles === null || files === null ? null : findEntry(files.styles, styleName)
  const imageName = style === null ? undefined : getPropertyValues(style, 0x28)?.[0]
  return typeof imageName === 'string' ? imageName : styleName
}

const getSessionOrNull = (runtime: ScreenRuntime): BuilderSession | null => runtime.builder

const getChooserWidgets = (runtime: ScreenRuntime, session: BuilderSession): FrontEndWidget[] => {
  const catalog = runtime.resources.getBuilderCatalog()
  const sets = getRectangle(runtime, 'sets')
  const pieces = getRectangle(runtime, 'pieces')
  const setBricks = catalog.sets[session.setIndex]?.bricks ?? []
  const brick = setBricks[session.pieceIndex]
  const colorName = catalog.colors[brick?.colorIndex ?? 0]?.name ?? ''
  const pieceLabel = `${(brick?.pieceName ?? '').toUpperCase()}  ${colorName.toUpperCase()}`
  const getArrow = (name: string, rectangle: FrontEndRectangle): FrontEndWidget => ({
    kind: 'placed_image',
    imageName: name,
    rectangle,
  })
  const setImage = getSetImageName(runtime, session.setIndex)
  return [
    getArrow('arrowlu', {
      left: sets.left,
      top: sets.top + 6,
      right: sets.left + CHOOSER_ARROW_SIZE,
      bottom: sets.top + 6 + CHOOSER_ARROW_SIZE,
    }),
    {
      kind: 'placed_image',
      imageName: setImage,
      rectangle: {
        left: sets.left + 32,
        top: sets.top,
        right: sets.left + 186,
        bottom: sets.top + 44,
      },
    },
    getArrow('arrowru', {
      left: sets.left + 186,
      top: sets.top + 6,
      right: sets.left + 186 + CHOOSER_ARROW_SIZE,
      bottom: sets.top + 6 + CHOOSER_ARROW_SIZE,
    }),
    getArrow('arrowlu', {
      left: pieces.left,
      top: pieces.top + 11,
      right: pieces.left + CHOOSER_ARROW_SIZE,
      bottom: pieces.top + 11 + CHOOSER_ARROW_SIZE,
    }),
    {
      kind: 'placed_text',
      text: `${pieceLabel}  ${String(session.pieceIndex + 1)}/${String(setBricks.length)}`,
      styleName: TEXT_STYLE,
      rectangle: {
        left: pieces.left + 32,
        top: pieces.top + 14,
        right: pieces.left + 388,
        bottom: pieces.top + 46,
      },
      alignment: 'center',
      color: LABEL_COLOR,
    },
    getArrow('arrowru', {
      left: pieces.left + 388,
      top: pieces.top + 11,
      right: pieces.left + 388 + CHOOSER_ARROW_SIZE,
      bottom: pieces.top + 11 + CHOOSER_ARROW_SIZE,
    }),
  ]
}

const getButtonWidgets = (): FrontEndWidget[] => [
  { kind: 'image', itemName: 'rotbrik', imageName: 'rotateu' },
  { kind: 'image', itemName: 'addbrik', imageName: 'downu' },
  { kind: 'image', itemName: 'undobrik', imageName: 'upu' },
  { kind: 'image', itemName: 'goback', imageName: 'exitu' },
  // The rockers' own items nest their position one block deeper (`3d` items hold a `3b` button); their rectangles are
  // (51, 40) and (51, 301) of the description.
  {
    kind: 'placed_image',
    imageName: 'mtu',
    rectangle: { left: 51, top: 40, right: 171, bottom: 152 },
  },
  {
    kind: 'placed_image',
    imageName: 'camerau',
    rectangle: { left: 51, top: 301, right: 143, bottom: 393 },
  },
]

// 0x004736b0 .. 0x00475010: the sets and pieces choosers on top, the three buttons and the two rockers on the left and
// the garage world with the car in it.
const getWidgets = (runtime: ScreenRuntime): readonly FrontEndWidget[] => {
  const session = getSessionOrNull(runtime)
  if (session === null) return [{ kind: 'image', itemName: 'backdrp', imageName: 'backdrp' }]
  return [
    { kind: 'image', itemName: 'backdrp', imageName: 'backdrp' },
    ...getChooserWidgets(runtime, session),
    ...getButtonWidgets(),
    {
      kind: 'viewport',
      itemName: 'garage',
      builder: {
        design: getBuilderPreviewDesign(session),
        cameraYaw: session.cameraYaw,
        cameraPitch: session.cameraPitch,
      },
    },
  ]
}

const getBuilderResult = (
  runtime: ScreenRuntime,
  builder: BuilderSession,
  sound: string | null
): ScreenResult => createResult(runtime, { builder, soundNames: sound === null ? [] : [sound] })

// 0x00473ee0: the keys the screen reads. A move uses the view's step tables, a refused one plays the refusal.
const handleMove = (
  runtime: ScreenRuntime,
  session: BuilderSession,
  input: FrontEndInput
): ScreenResult => {
  const directionIndex = DIRECTION_INDICES[input] ?? 0
  const stepX = getDirectionXStep(session.cameraYaw, directionIndex)
  const stepY = getDirectionYStep(session.cameraYaw, directionIndex)
  const result = moveBuilderSession(session, stepX, stepY, true)
  return getBuilderResult(
    runtime,
    result.session,
    result.isMoved ? MenuSound.HIGHLIGHT : MenuSound.REFUSED
  )
}

// What leaving takes into the race: the design, on the chassis of the set, with the racer record of DEFAULT.LRS (name and
// driver; **hypothesis**: the original's "edit driver" screens fill them, which the garage will).
const getLeaveResult = (runtime: ScreenRuntime, session: BuilderSession): ScreenResult => {
  const catalog = runtime.resources.getBuilderCatalog()
  const template = runtime.resources.getRacerTemplate()
  const chassisName = catalog.sets[session.setIndex]?.chassisName ?? template.chassisName
  return createResult(runtime, {
    settings: {
      ...runtime.settings,
      playerCar: {
        record: {
          ...template,
          chassisName,
          designBytes: Array.from(serializeCarDesign(session.design)),
        },
        design: session.design,
      },
    },
    navigation: { kind: 'pop' },
    soundNames: [MenuSound.BACK],
  })
}

const handleInput = (runtime: ScreenRuntime, input: FrontEndInput): ScreenResult => {
  const catalog = runtime.resources.getBuilderCatalog()
  const session = runtime.builder ?? createBuilderSession(catalog)
  switch (input) {
    case 'up':
    case 'down':
    case 'left':
    case 'right':
      return handleMove(runtime, session, input)
    case 'accept': {
      const result = placeBuilderBrick(session)
      return result.kind === 'placed'
        ? getBuilderResult(runtime, result.session, MenuSound.ACCEPT)
        : getBuilderResult(runtime, session, MenuSound.REFUSED)
    }
    case 'rotate':
      return getBuilderResult(runtime, rotateBuilderSession(session), MenuSound.HIGHLIGHT)
    case 'undo': {
      const result = undoBuilderBrick(catalog, session)
      return result.kind === 'placed'
        ? getBuilderResult(runtime, result.session, MenuSound.BACK)
        : getBuilderResult(runtime, session, MenuSound.REFUSED)
    }
    case 'previous_piece':
    case 'next_piece':
      return getBuilderResult(
        runtime,
        selectBuilderPiece(catalog, session, input === 'next_piece' ? 1 : -1),
        MenuSound.HIGHLIGHT
      )
    case 'previous_set':
    case 'next_set':
      return getBuilderResult(
        runtime,
        selectBuilderSet(catalog, session, input === 'next_set' ? 1 : -1),
        MenuSound.HIGHLIGHT
      )
    case 'view_left':
    case 'view_right':
      return getBuilderResult(
        runtime,
        turnBuilderCamera(session, input === 'view_right' ? 1 : -1),
        MenuSound.HIGHLIGHT
      )
    case 'view_up':
    case 'view_down': {
      const raised = raiseBuilderCamera(session, input === 'view_up' ? 1 : -1)
      return getBuilderResult(
        runtime,
        raised,
        raised.cameraPitch === session.cameraPitch ? MenuSound.REFUSED : MenuSound.HIGHLIGHT
      )
    }
    case 'back':
      return getLeaveResult(runtime, session)
  }
}

export const CAR_BUILD_SCREEN: ScreenDefinition = Object.freeze({
  screenId: FrontEndScreen.CAR_BUILD,
  getWidgets,
  handleInput,
})
