import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { PauseMenu } from './pause-menu.types.ts'

// Race +0x30c0, set by Race_RunLoop 0x00432540 and 0x00435c00 and read by Race_Update 0x00435220.
export const PauseMenuMode = createEnum({
  // 0: no menu; the race runs.
  NONE: 'none',
  // 1: the pause menu (0x00436010 shows 3 items).
  PAUSED: 'paused',
  // 2: the ghost's result menu (2 items), opened by Race_UpdateState4 after 9,500 ms with a ghost.
  RESULTS: 'results',
  // 3: the confirmation of the pending action (2 items, the second selected first).
  CONFIRMATION: 'confirmation',
})

// Race +0x3360: what the paused race was asked to do, until it is confirmed.
export const PendingAction = createEnum({
  NONE: 'none',
  // 1: restart the race.
  RESTART: 'restart',
  // 2: quit the race.
  QUIT: 'quit',
})

// The items of each menu (the menu's +0x4c, set by 0x00427310): 0x00436010 passes 3, 2 and 2.
export const PAUSE_MENU_ITEM_COUNTS = Object.freeze({
  [PauseMenuMode.NONE]: 0,
  [PauseMenuMode.PAUSED]: 3,
  [PauseMenuMode.RESULTS]: 2,
  [PauseMenuMode.CONFIRMATION]: 2,
})

// The item selected when a menu opens (0x00436010: 0, 0 and, for the confirmation, 1).
export const PAUSE_MENU_FIRST_SELECTIONS = Object.freeze({
  [PauseMenuMode.NONE]: 0,
  [PauseMenuMode.PAUSED]: 0,
  [PauseMenuMode.RESULTS]: 0,
  [PauseMenuMode.CONFIRMATION]: 1,
})

// 0x00427420: the menu's blink timer wraps at 500 ms.
export const PAUSE_MENU_BLINK_PERIOD_MILLISECONDS = 500

export const CLOSED_PAUSE_MENU: PauseMenu = Object.freeze({
  mode: PauseMenuMode.NONE,
  selection: 0,
  isAnswered: false,
  pendingAction: PendingAction.NONE,
  blinkMilliseconds: 0,
})
