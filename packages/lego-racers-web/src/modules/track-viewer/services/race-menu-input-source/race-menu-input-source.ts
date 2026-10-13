import { NO_MENU_INPUT } from '@lego-games/lego-racers/race'
import type { RaceMenuInput } from '@lego-games/lego-racers/race'
import type { RaceMenuInputSource } from './race-menu-input-source.types.ts'

// The key codes of 0x00435c00 and 0x00427810: escape and pause open the menu, up and down move the selection, enter
// and space answer it (0x10000001, 0x100000c5, 0x100000c8, 0x100000d0, 0x1000001c, 0x10000039).
const MENU_KEYS: ReadonlyMap<string, RaceMenuInput> = new Map([
  ['Escape', { ...NO_MENU_INPUT, isPausePressed: true, isAnyInputPressed: true }],
  ['Pause', { ...NO_MENU_INPUT, isPausePressed: true, isAnyInputPressed: true }],
  ['ArrowUp', { ...NO_MENU_INPUT, selectionChange: -1, isAnyInputPressed: true }],
  ['ArrowDown', { ...NO_MENU_INPUT, selectionChange: 1, isAnyInputPressed: true }],
  ['Enter', { ...NO_MENU_INPUT, isConfirmPressed: true, isAnyInputPressed: true }],
  ['NumpadEnter', { ...NO_MENU_INPUT, isConfirmPressed: true, isAnyInputPressed: true }],
  ['Space', { ...NO_MENU_INPUT, isConfirmPressed: true, isAnyInputPressed: true }],
])
// Standard gamepad mapping: A confirms (0x3000000c..f joystick buttons), start pauses, the d-pad moves.
const GAMEPAD_MENU_BUTTONS: ReadonlyMap<number, RaceMenuInput> = new Map([
  [0, { ...NO_MENU_INPUT, isConfirmPressed: true, isAnyInputPressed: true }],
  [9, { ...NO_MENU_INPUT, isPausePressed: true, isAnyInputPressed: true }],
  [12, { ...NO_MENU_INPUT, selectionChange: -1, isAnyInputPressed: true }],
  [13, { ...NO_MENU_INPUT, selectionChange: 1, isAnyInputPressed: true }],
])
const CONFIRM_RELEASE_INPUT: RaceMenuInput = Object.freeze({
  ...NO_MENU_INPUT,
  isConfirmReleased: true,
})
const WINDOW_BLUR_INPUT: RaceMenuInput = Object.freeze({ ...NO_MENU_INPUT, isPausePressed: true })

// The keyboard and the first gamepad as menu keys. The original's key handler takes one key per call, so each key
// goes down is handed to one frame; the window losing the focus pauses the race (application flag 0x4000).
export const createRaceMenuInputSource = (): RaceMenuInputSource => {
  const pending: RaceMenuInput[] = []
  let previousButtons: ReadonlySet<number> = new Set()
  const onKeyDown = (event: KeyboardEvent) => {
    const input = MENU_KEYS.get(event.code)
    pending.push(input ?? Object.freeze({ ...NO_MENU_INPUT, isAnyInputPressed: true }))
  }
  const onKeyUp = (event: KeyboardEvent) => {
    if (MENU_KEYS.get(event.code)?.isConfirmPressed === true) pending.push(CONFIRM_RELEASE_INPUT)
  }
  const onBlur = () => pending.push(WINDOW_BLUR_INPUT)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  const readGamepadButtons = (): ReadonlySet<number> => {
    const gamepad = navigator.getGamepads().find((candidate) => candidate !== null) ?? null
    return new Set(
      gamepad === null
        ? []
        : gamepad.buttons.flatMap((button, index) => (button.pressed ? [index] : []))
    )
  }
  return Object.freeze({
    read: (): RaceMenuInput => {
      const buttons = readGamepadButtons()
      for (const [button, input] of GAMEPAD_MENU_BUTTONS) {
        if (buttons.has(button) && !previousButtons.has(button)) pending.push(input)
        if (input.isConfirmPressed && !buttons.has(button) && previousButtons.has(button)) {
          pending.push(CONFIRM_RELEASE_INPUT)
        }
      }
      previousButtons = buttons
      return pending.shift() ?? NO_MENU_INPUT
    },
    dispose: () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    },
  })
}
