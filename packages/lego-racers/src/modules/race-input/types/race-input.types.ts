import type { EnumValues } from '../../../shared/types/enum.types.ts'
import type { RaceBinding as RaceBindingValues } from './race-binding/race-binding.ts'

export type RaceBinding = EnumValues<typeof RaceBindingValues>

// One default keyboard binding: the value the player controller compares (0x10000000 | DirectInput scan code,
// table 0x004b0624) and the browser key it stands for.
export type KeyboardBinding = {
  readonly binding: RaceBinding
  readonly bindingNumber: number
  readonly bindingCode: number
  readonly keyCode: string
  readonly keyLabel: string
}

// The browser's view of a gamepad: axes in -1..1 and which buttons are down, by index.
export type GamepadSnapshot = {
  readonly axes: readonly number[]
  readonly pressedButtonIndices: readonly number[]
}

export type RaceInputSnapshot = {
  // KeyboardEvent.code of every key that is down.
  readonly pressedKeyCodes: ReadonlySet<string>
  readonly gamepad: GamepadSnapshot | null
}
