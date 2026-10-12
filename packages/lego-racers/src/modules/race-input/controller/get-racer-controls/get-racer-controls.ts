import { IDLE_RACER_CONTROLS } from '../../../race/index.ts'
import type { RacerControls } from '../../../racer/index.ts'
import { RaceBinding } from '../../types/race-binding/race-binding.ts'
import type { GamepadSnapshot, RaceInputSnapshot } from '../../types/race-input.types.ts'
import {
  DEFAULT_KEYBOARD_BINDINGS,
  GAMEPAD_BUTTON_BINDINGS,
  GAMEPAD_STEERING_AXIS_INDEX,
} from '../default-bindings/default-bindings.ts'

const getHeldKeyboardBindings = (pressedKeyCodes: ReadonlySet<string>) =>
  DEFAULT_KEYBOARD_BINDINGS.filter((keyboardBinding) =>
    pressedKeyCodes.has(keyboardBinding.keyCode)
  ).map((keyboardBinding) => keyboardBinding.binding)

const getHeldGamepadBindings = (gamepad: GamepadSnapshot | null) =>
  gamepad === null
    ? []
    : gamepad.pressedButtonIndices.flatMap((buttonIndex) => {
        const binding = GAMEPAD_BUTTON_BINDINGS[buttonIndex]
        return binding === undefined ? [] : [binding]
      })

// The game gives the joystick the range -1000..1000 (SetProperty in 0x0044ec30) and reads each axis as the integer times
// 0.001f (0x0044eda0, constant 0x004af6fc), so the browser's axis becomes that integer first.
const DIRECT_INPUT_AXIS_RANGE = 1000
const DIRECT_INPUT_AXIS_SCALE = Math.fround(0.001) // float32 0.001 at 0x004af6fc

export const getJoystickAxisUnits = (axis: number): number =>
  Math.max(
    -DIRECT_INPUT_AXIS_RANGE,
    Math.min(DIRECT_INPUT_AXIS_RANGE, Math.round(axis * DIRECT_INPUT_AXIS_RANGE))
  ) + 0

// The steering axis the device returns (device axis 1 of the controller, negated by 0x00430120); the keyboard
// leaves it at 0 and the digital bindings win.
const getSteeringAxis = (gamepad: GamepadSnapshot | null): number =>
  Math.fround(
    getJoystickAxisUnits(gamepad?.axes[GAMEPAD_STEERING_AXIS_INDEX] ?? 0) * DIRECT_INPUT_AXIS_SCALE
  )

// A gamepad (DirectInput sub type 4) has its stick axis turned into key events (0x0044ee40, 0x0044bb60): any value below 0
// presses the axis code 0x40000001 (binding 0, steer positive), any above 0 presses 0x40000000 (binding 1), with no dead
// zone. So the stick steers through the digital bindings, and the analog axis (read only while neither is down) is 0.
const getAxisBindings = (gamepad: GamepadSnapshot | null) => {
  const units = getJoystickAxisUnits(gamepad?.axes[GAMEPAD_STEERING_AXIS_INDEX] ?? 0)
  if (units < 0) return [RaceBinding.STEER_POSITIVE]
  return units > 0 ? [RaceBinding.STEER_NEGATIVE] : []
}

// What the player controller's nine binding handlers (0x004309c0) and the device's axis would hold this frame:
// one flag per held binding and the steering axis. The race (`stepRace`) takes it as it is.
export const getRacerControls = (snapshot: RaceInputSnapshot): RacerControls => {
  const held = new Set([
    ...getHeldKeyboardBindings(snapshot.pressedKeyCodes),
    ...getHeldGamepadBindings(snapshot.gamepad),
    ...getAxisBindings(snapshot.gamepad),
  ])
  return Object.freeze({
    ...IDLE_RACER_CONTROLS,
    isSteerPositivePressed: held.has(RaceBinding.STEER_POSITIVE),
    isSteerNegativePressed: held.has(RaceBinding.STEER_NEGATIVE),
    isAcceleratePressed: held.has(RaceBinding.ACCELERATE),
    isBrakePressed: held.has(RaceBinding.BRAKE),
    isUsePowerUpPressed: held.has(RaceBinding.USE_POWER_UP),
    isChangeCameraPressed: held.has(RaceBinding.CHANGE_CAMERA),
    isChangeHudModePressed: held.has(RaceBinding.CHANGE_HUD_MODE),
    isPowerSlidePressed: held.has(RaceBinding.POWER_SLIDE),
    isLookBehindPressed: held.has(RaceBinding.LOOK_BEHIND),
    steeringAxis: getSteeringAxis(snapshot.gamepad),
  })
}
