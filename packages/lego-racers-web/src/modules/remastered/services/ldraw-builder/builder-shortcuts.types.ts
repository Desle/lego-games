import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'

// What a key does in the builder; the page carries each one out.
export const BuilderAction = createEnum({
  ROTATE: 'rotate',
  ROTATE_BACK: 'rotate_back',
  TILT: 'tilt',
  TILT_BACK: 'tilt_back',
  MOVE_LEFT: 'move_left',
  MOVE_RIGHT: 'move_right',
  MOVE_AWAY: 'move_away',
  MOVE_TOWARD: 'move_toward',
  RAISE_PLATE: 'raise_plate',
  LOWER_PLATE: 'lower_plate',
  RAISE_BRICK: 'raise_brick',
  LOWER_BRICK: 'lower_brick',
  NUDGE_LEFT: 'nudge_left',
  NUDGE_RIGHT: 'nudge_right',
  NUDGE_AWAY: 'nudge_away',
  NUDGE_TOWARD: 'nudge_toward',
  NUDGE_UP: 'nudge_up',
  NUDGE_DOWN: 'nudge_down',
  DELETE: 'delete',
  COPY: 'copy',
  PASTE: 'paste',
  DUPLICATE: 'duplicate',
  UNDO: 'undo',
  REDO: 'redo',
  SELECT_ALL: 'select_all',
  SELECT_COLOR: 'select_color',
  SAVE: 'save',
  TAKE_COLOR: 'take_color',
  TAKE_PART: 'take_part',
  QUICK_COLOR: 'quick_color',
  CANCEL: 'cancel',
  FRAME: 'frame',
  REFERENCE: 'reference',
  WHEEL_GUIDES: 'wheel_guides',
  SHORTCUTS: 'shortcuts',
  SCALE_UP: 'scale_up',
  SCALE_DOWN: 'scale_down',
  SCALE_FIT: 'scale_fit',
})
export type BuilderAction = EnumValues<typeof BuilderAction>

// A key press as the builder reads it: Cmd and Ctrl both count as the command key.
export type BuilderKeyPress = {
  readonly key: string
  readonly isCommand: boolean
  readonly isShift: boolean
  readonly isOption: boolean
}

export type BuilderKeyCommand = {
  readonly action: BuilderAction
  // Which of the quick colours (0 to 8) for QUICK_COLOR, else -1.
  readonly quickColorIndex: number
}

export type BuilderShortcut = {
  readonly keys: string
  readonly description: string
}

export type BuilderShortcutGroup = {
  readonly title: string
  readonly shortcuts: readonly BuilderShortcut[]
}
