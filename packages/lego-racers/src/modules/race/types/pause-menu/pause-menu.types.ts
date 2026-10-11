import type { EnumValues } from '../../../../shared/types/enum.types.ts'
import type {
  PauseMenuMode as PauseMenuModeValues,
  PendingAction as PendingActionValues,
} from './pause-menu.ts'

export type PauseMenuMode = EnumValues<typeof PauseMenuModeValues>
export type PendingAction = EnumValues<typeof PendingActionValues>

// The race's menu state: the mode at race +0x30c0, the widget at race +0x3058 (selection +0x50, answered when its
// waiting flag +0x58 is 0, blink timer +0x54) and the pending action at +0x3360.
export type PauseMenu = {
  readonly mode: PauseMenuMode
  readonly selection: number
  // Race +0x30a0 == 2: the player chose an item and 0x00436160 has to apply it. **Hypothesis** for the writer of the 2: the
  // code that sets it was not found; the port sets it when a confirm key arrives (0x00427810 clears the waiting flag).
  readonly isAnswered: boolean
  readonly pendingAction: PendingAction
  readonly blinkMilliseconds: number
}

// What the player did with the menu this frame (the key codes 0x00435c00 and 0x00427810 match).
export type RaceMenuInput = {
  // Escape or the pause key (0x10000001, 0x100000c5), or the window losing the focus (the application flag 0x4000).
  readonly isPausePressed: boolean
  // Up (-1) or down (+1) in an open menu; the selection wraps.
  readonly selectionChange: number
  // Enter, space or a joystick button (0x1000001c, 0x10000039, 0x3000000c..0x3000000f).
  readonly isConfirmPressed: boolean
  // Any key, mouse or joystick button (code & 0x30000000): ends a demonstration.
  readonly isAnyInputPressed: boolean
}
