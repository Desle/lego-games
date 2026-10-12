import type { FrontEndInput } from '@lego-games/lego-racers/front-end'
import type { FrontEndInputSource } from './front-end-input-source.types.ts'

const KEY_INPUTS: ReadonlyMap<string, FrontEndInput> = new Map([
  ['ArrowUp', 'up'],
  ['ArrowDown', 'down'],
  ['ArrowLeft', 'left'],
  ['ArrowRight', 'right'],
  ['Enter', 'accept'],
  ['Space', 'accept'],
  ['Escape', 'back'],
  ['Backspace', 'back'],
  // The car builder reads the numeric keypad (5 turns, + adds, - takes off), A and D turn the view, S and X raise and lower
  // it (0x00473ee0); the letters and page keys are this port's laptop-friendly twins, and the choosers take page up and
  // down (bricks) and insert and delete (sets).
  ['KeyR', 'rotate'],
  ['Numpad5', 'rotate'],
  ['KeyU', 'undo'],
  ['NumpadSubtract', 'undo'],
  ['NumpadAdd', 'accept'],
  ['NumpadEnter', 'accept'],
  ['PageUp', 'previous_piece'],
  ['KeyQ', 'previous_piece'],
  ['PageDown', 'next_piece'],
  ['KeyE', 'next_piece'],
  ['Insert', 'previous_set'],
  ['KeyZ', 'previous_set'],
  ['Delete', 'next_set'],
  ['KeyC', 'next_set'],
  ['KeyA', 'view_left'],
  ['KeyD', 'view_right'],
  ['KeyS', 'view_up'],
  ['KeyX', 'view_down'],
])

// Standard gamepad mapping: the d-pad, button 0 (A) accepts and button 1 (B) goes back.
const GAMEPAD_BUTTON_INPUTS: ReadonlyMap<number, FrontEndInput> = new Map([
  [12, 'up'],
  [13, 'down'],
  [14, 'left'],
  [15, 'right'],
  [0, 'accept'],
  [1, 'back'],
])
const STICK_THRESHOLD = 0.6

const getGamepads = (): readonly Gamepad[] =>
  typeof navigator.getGamepads === 'function'
    ? navigator.getGamepads().filter((gamepad): gamepad is Gamepad => gamepad !== null)
    : []

const getHeldInputs = (gamepad: Gamepad | undefined): ReadonlySet<FrontEndInput> => {
  const held = new Set<FrontEndInput>()
  if (gamepad === undefined) return held
  for (const [index, input] of GAMEPAD_BUTTON_INPUTS) {
    if (gamepad.buttons[index]?.pressed === true) held.add(input)
  }
  const horizontal = gamepad.axes[0] ?? 0
  const vertical = gamepad.axes[1] ?? 0
  if (horizontal <= -STICK_THRESHOLD) held.add('left')
  if (horizontal >= STICK_THRESHOLD) held.add('right')
  if (vertical <= -STICK_THRESHOLD) held.add('up')
  if (vertical >= STICK_THRESHOLD) held.add('down')
  return held
}

// The menus' keyboard and gamepad as the six inputs the front end takes. A key reaches the front end when it goes
// down (and repeats with the keyboard); a gamepad input when it becomes pressed.
export const createFrontEndInputSource = (): FrontEndInputSource => {
  const pending: FrontEndInput[] = []
  let previousHeld: ReadonlySet<FrontEndInput> = new Set()
  const onKeyDown = (event: KeyboardEvent) => {
    const input = KEY_INPUTS.get(event.code)
    if (input === undefined) return
    event.preventDefault()
    pending.push(input)
  }
  window.addEventListener('keydown', onKeyDown)
  return Object.freeze({
    read: () => {
      const held = getHeldInputs(getGamepads()[0])
      for (const input of held) if (!previousHeld.has(input)) pending.push(input)
      previousHeld = held
      return pending.splice(0, pending.length)
    },
    getControllerCount: () => getGamepads().length,
    dispose: () => window.removeEventListener('keydown', onKeyDown),
  })
}
