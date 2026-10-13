import { BuilderAction } from './builder-shortcuts.types.ts'
import type {
  BuilderKeyCommand,
  BuilderKeyPress,
  BuilderShortcutGroup,
} from './builder-shortcuts.types.ts'

// LDraw colour codes for keys 1 to 9: black, white, red, blue, yellow, green, light and dark bluish grey, orange.
export const QUICK_COLOR_CODES: readonly number[] = [0, 15, 4, 1, 14, 2, 71, 72, 25]

const NO_QUICK_COLOR = -1

const COMMAND_ACTIONS: Readonly<Record<string, BuilderAction>> = {
  z: BuilderAction.UNDO,
  y: BuilderAction.REDO,
  c: BuilderAction.COPY,
  v: BuilderAction.PASTE,
  d: BuilderAction.DUPLICATE,
  a: BuilderAction.SELECT_ALL,
  s: BuilderAction.SAVE,
  arrowup: BuilderAction.RAISE_PLATE,
  arrowdown: BuilderAction.LOWER_PLATE,
}
const COMMAND_SHIFT_ACTIONS: Readonly<Record<string, BuilderAction>> = {
  z: BuilderAction.REDO,
  arrowup: BuilderAction.RAISE_BRICK,
  arrowdown: BuilderAction.LOWER_BRICK,
}
// With Option a Mac types ≠ for =, – for - and º for 0; the keys are read either way.
const OPTION_ACTIONS: Readonly<Record<string, BuilderAction>> = {
  arrowleft: BuilderAction.NUDGE_LEFT,
  arrowright: BuilderAction.NUDGE_RIGHT,
  arrowup: BuilderAction.NUDGE_AWAY,
  arrowdown: BuilderAction.NUDGE_TOWARD,
  '=': BuilderAction.SCALE_UP,
  '≠': BuilderAction.SCALE_UP,
  '-': BuilderAction.SCALE_DOWN,
  '–': BuilderAction.SCALE_DOWN,
  '0': BuilderAction.SCALE_FIT,
  º: BuilderAction.SCALE_FIT,
}
const OPTION_COMMAND_ACTIONS: Readonly<Record<string, BuilderAction>> = {
  arrowup: BuilderAction.NUDGE_UP,
  arrowdown: BuilderAction.NUDGE_DOWN,
}
const PLAIN_ACTIONS: Readonly<Record<string, BuilderAction>> = {
  r: BuilderAction.ROTATE,
  t: BuilderAction.TILT,
  arrowleft: BuilderAction.MOVE_LEFT,
  arrowright: BuilderAction.MOVE_RIGHT,
  arrowup: BuilderAction.MOVE_AWAY,
  arrowdown: BuilderAction.MOVE_TOWARD,
  backspace: BuilderAction.DELETE,
  delete: BuilderAction.DELETE,
  e: BuilderAction.TAKE_COLOR,
  escape: BuilderAction.CANCEL,
  f: BuilderAction.FRAME,
  g: BuilderAction.REFERENCE,
  w: BuilderAction.WHEEL_GUIDES,
  '?': BuilderAction.SHORTCUTS,
}
const SHIFT_ACTIONS: Readonly<Record<string, BuilderAction>> = {
  r: BuilderAction.ROTATE_BACK,
  t: BuilderAction.TILT_BACK,
  e: BuilderAction.TAKE_PART,
  a: BuilderAction.SELECT_COLOR,
  '?': BuilderAction.SHORTCUTS,
}

const getQuickColorIndex = (key: string): number => {
  const digit = Number(key)
  return /^[1-9]$/.test(key) && digit <= QUICK_COLOR_CODES.length ? digit - 1 : NO_QUICK_COLOR
}

const getOptionAction = (press: BuilderKeyPress, key: string): BuilderAction | undefined =>
  press.isShift ? undefined : (press.isCommand ? OPTION_COMMAND_ACTIONS : OPTION_ACTIONS)[key]

// The builder's command for a key press, null for a key it leaves to the browser. Option only nudges with the arrows and scales with
// = - 0: on a Mac it types symbols with letters.
export const getBuilderKeyCommand = (press: BuilderKeyPress): BuilderKeyCommand | null => {
  const key = press.key.toLowerCase()
  if (press.isOption) {
    const optionAction = getOptionAction(press, key)
    return optionAction === undefined
      ? null
      : Object.freeze({ action: optionAction, quickColorIndex: NO_QUICK_COLOR })
  }
  const quickColorIndex =
    press.isCommand || press.isShift ? NO_QUICK_COLOR : getQuickColorIndex(key)
  if (quickColorIndex !== NO_QUICK_COLOR) {
    return Object.freeze({ action: BuilderAction.QUICK_COLOR, quickColorIndex })
  }
  const table = press.isCommand
    ? press.isShift
      ? COMMAND_SHIFT_ACTIONS
      : COMMAND_ACTIONS
    : press.isShift
      ? SHIFT_ACTIONS
      : PLAIN_ACTIONS
  const action = table[key]
  return action === undefined ? null : Object.freeze({ action, quickColorIndex: NO_QUICK_COLOR })
}

// The full list for the ? overlay, in the Mac's key symbols.
export const BUILDER_SHORTCUT_GROUPS: readonly BuilderShortcutGroup[] = [
  {
    title: 'Camera (trackpad)',
    shortcuts: [
      { keys: 'Two-finger scroll', description: 'orbit' },
      { keys: '⇧ two-finger scroll', description: 'pan' },
      { keys: 'Pinch', description: 'zoom' },
      { keys: '⌥ drag', description: 'orbit' },
      { keys: '⌥⇧ drag', description: 'pan' },
      { keys: 'F', description: 'frame the model' },
    ],
  },
  {
    title: 'Building',
    shortcuts: [
      { keys: 'Pick a part', description: 'take it in hand: it follows the cursor on the studs' },
      { keys: 'Click', description: 'place the part in hand (it stays in hand)' },
      { keys: '⎋', description: 'put the part down, else deselect' },
      {
        keys: 'Click a part',
        description: 'select it (empty hand); click empty space to deselect',
      },
      { keys: '⇧ click', description: 'add to or remove from the selection' },
      { keys: 'Drag', description: 'move the selection along the stud grid' },
      { keys: 'R  ⇧R', description: 'rotate 90° left, right (selection, else part in hand)' },
      {
        keys: 'T  ⇧T',
        description:
          'tilt 90° about the axis across the view: lay a brick on its side, face it out',
      },
      {
        keys: 'Side stud',
        description: 'point at it: the part in hand turns its bottom to it and snaps on',
      },
      { keys: '← → ↑ ↓', description: 'move the selection a stud, as the camera looks' },
      { keys: '⌘↑  ⌘↓', description: 'move the selection a plate up, down' },
      { keys: '⇧⌘↑  ⇧⌘↓', description: 'move the selection a brick up, down' },
      { keys: '⌥← ⌥→ ⌥↑ ⌥↓', description: 'nudge the selection a quarter stud' },
      { keys: '⌥⌘↑  ⌥⌘↓', description: 'nudge the selection half a plate up, down' },
      { keys: '⌫', description: 'delete the selection' },
      { keys: '⌘C  ⌘V  ⌘D', description: 'copy, paste, duplicate' },
      { keys: '⌘A', description: 'select every part' },
      { keys: '⌘Z  ⇧⌘Z', description: 'undo, redo' },
    ],
  },
  {
    title: 'Colour',
    shortcuts: [
      { keys: 'E  or  ⌥ click', description: 'take the colour of the part under the cursor' },
      { keys: '⇧E', description: 'take the part under the cursor in hand (shape, colour, turn)' },
      { keys: '1 – 9', description: 'black, white, red, blue, yellow, green, greys, orange' },
      {
        keys: 'Swatch or 1 – 9',
        description: 'with parts selected: repaint them (⌘Z undoes it)',
      },
      {
        keys: '⇧A  or  ⌥⇧ click',
        description: 'select every part of the colour under the cursor (else the selected one)',
      },
    ],
  },
  {
    title: 'Page',
    shortcuts: [
      { keys: '⌘S', description: 'Done: save into the models folder, open the next' },
      { keys: 'G', description: 'original: side by side, ghost, off' },
      { keys: 'W', description: 'wheel guides on, off' },
      {
        keys: '⌥=  ⌥-',
        description: 'power-up or particle: draw the build bigger, smaller (the race draws it so)',
      },
      {
        keys: '⌥0',
        description: "power-up: fit to the original's size; particle: real LEGO size",
      },
      { keys: '?', description: 'this list' },
    ],
  },
]

// The always visible reminder in the corner of the build view.
export const BUILDER_SHORTCUT_HINTS: readonly string[] = [
  'Scroll orbit · ⇧ scroll pan · pinch zoom · ⌥ drag orbit',
  'R rotate · T tilt · ⌫ delete · ⌘Z undo · ⌘S done · ? all shortcuts',
]
