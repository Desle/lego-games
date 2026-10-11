import type { BuiltCar } from '../../../racer-setup/index.ts'

export type SettingsRequest = {
  readonly racerCount: number
  readonly localPlayerCount: number
  readonly multiplayerLapCount?: number
  readonly raceModeFlags?: number
  readonly isCountdownSkipped?: boolean
  readonly playerCars?: readonly BuiltCar[]
  readonly playerNames?: readonly string[]
  readonly randomPosition?: number
}

export type CircuitSettingsRequest = SettingsRequest & {
  // The key of a circuit of LEGORACE.CRB (c0 to c6).
  readonly circuitName: string
}

export type SingleRaceSettingsRequest = SettingsRequest & {
  // The key of a race of LEGORACE.RCB (igp, rkr, ...).
  readonly raceName: string
}

export type DemonstrationRequest = {
  readonly randomPosition: number
}
