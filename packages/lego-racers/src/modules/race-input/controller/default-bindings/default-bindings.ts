import { RaceBinding } from '../../types/race-binding/race-binding.ts'
import type { KeyboardBinding } from '../../types/race-input.types.ts'

// A keyboard binding code is 0x10000000 | the DirectInput scan code (the front end's 0x0042ee70 stores it, the
// player controller's 0x004309c0 compares it with the event's code).
const KEYBOARD_BINDING_FLAG = 0x10000000

const createKeyboardBinding = (
  bindingNumber: number,
  binding: KeyboardBinding['binding'],
  scanCode: number,
  keyCode: string,
  keyLabel: string
): KeyboardBinding =>
  Object.freeze({
    binding,
    bindingNumber,
    bindingCode: KEYBOARD_BINDING_FLAG | scanCode,
    keyCode,
    keyLabel,
  })

// The first keyboard layout of the table at 0x004b0624 (nine codes per layout, read by 0x0042ef00 and copied into
// the controls set-up by 0x0042e960): Left, Right, Up, Down, Enter, right Ctrl, M, Space, right Alt. A single
// local player without a joystick gets this layout (0x0042eac0 answers 2, the first keyboard layout).
export const DEFAULT_KEYBOARD_BINDINGS: readonly KeyboardBinding[] = Object.freeze([
  createKeyboardBinding(0, RaceBinding.STEER_POSITIVE, 0xcb, 'ArrowLeft', 'Left arrow'),
  createKeyboardBinding(1, RaceBinding.STEER_NEGATIVE, 0xcd, 'ArrowRight', 'Right arrow'),
  createKeyboardBinding(2, RaceBinding.ACCELERATE, 0xc8, 'ArrowUp', 'Up arrow'),
  createKeyboardBinding(3, RaceBinding.BRAKE, 0xd0, 'ArrowDown', 'Down arrow'),
  createKeyboardBinding(4, RaceBinding.USE_POWER_UP, 0x1c, 'Enter', 'Enter'),
  createKeyboardBinding(5, RaceBinding.CHANGE_CAMERA, 0x9d, 'ControlRight', 'Right Ctrl'),
  createKeyboardBinding(6, RaceBinding.CHANGE_HUD_MODE, 0x32, 'KeyM', 'M'),
  createKeyboardBinding(7, RaceBinding.POWER_SLIDE, 0x39, 'Space', 'Space'),
  createKeyboardBinding(8, RaceBinding.LOOK_BEHIND, 0xb8, 'AltRight', 'Right Alt'),
])

// Joystick set-up of 0x0042e960: bindings 0 and 1 are the axis codes 0x40000001 and 0x40000000, bindings 2..8 are
// the device's buttons 0..6 (code 0x30000000 | button number).
export const GAMEPAD_STEERING_AXIS_INDEX = 0

// Binding 2 + n is gamepad button n.
export const GAMEPAD_BUTTON_BINDINGS: readonly KeyboardBinding['binding'][] = Object.freeze([
  RaceBinding.ACCELERATE,
  RaceBinding.BRAKE,
  RaceBinding.USE_POWER_UP,
  RaceBinding.CHANGE_CAMERA,
  RaceBinding.CHANGE_HUD_MODE,
  RaceBinding.POWER_SLIDE,
  RaceBinding.LOOK_BEHIND,
])
