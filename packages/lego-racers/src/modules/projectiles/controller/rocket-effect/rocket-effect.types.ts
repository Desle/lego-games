import type { HomingFlight } from '../../types/homing-flight/homing-flight.types.ts'

// 0x00456680 and 0x00423980: the body a rocket starts with and the racer it was aimed at.
export type LaunchedRocket = {
  readonly homing: HomingFlight
  readonly targetRacer: number | null
}
