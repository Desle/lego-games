import type { EmulatorArgument } from '../../../../shared/emulator/emulator-client.types.ts'
import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import type { HazardInstance } from '../../types/hazard-runtime.types.ts'

// What one touch is run with: the racer's flags (+0xd04), the car body flags (+0xaa8) and the forward speed (+0xa00).
export type TouchCase = {
  readonly racerFlags: number
  readonly spinFlags: number
  readonly forwardSpeed: number
}

export type TouchSuiteDefinition = {
  readonly name: string
  readonly label: string
  // The touch callback (vtable slot +0).
  readonly address: number
  readonly behavior: HazardBehavior
  readonly instance: HazardInstance
  // The hazard object's words before the call.
  readonly getHazardWords: () => readonly EmulatorArgument[]
  // What the call leaves in the hazard object that the port keeps, original against port.
  readonly getOriginalState: (words: readonly number[]) => string
  readonly getPortState: (instance: HazardInstance) => string
}

// The calls a port reaction stands for, in the order the original makes them, and the hazard it leaves.
export type TouchPortOutcome = {
  readonly commands: readonly string[]
  readonly instance: HazardInstance
}
