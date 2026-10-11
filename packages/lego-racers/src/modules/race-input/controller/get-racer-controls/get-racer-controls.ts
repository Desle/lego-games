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

// The steering axis the device returns (device axis 1 of the controller, negated by 0x00430120); the keyboard
// leaves it at 0 and the digital bindings win.
const getSteeringAxis = (gamepad: GamepadSnapshot | null): number =>
  Math.fround(gamepad?.axes[GAMEPAD_STEERING_AXIS_INDEX] ?? 0)

// What the player controller's nine binding handlers (0x004309c0) and the device's axis would hold this frame:
// one flag per held binding and the steering axis. The race (`stepRace`) takes it as it is.
export const getRacerControls = (snapshot: RaceInputSnapshot): RacerControls => {
  const held = new Set([
    ...getHeldKeyboardBindings(snapshot.pressedKeyCodes),
    ...getHeldGamepadBindings(snapshot.gamepad),
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
