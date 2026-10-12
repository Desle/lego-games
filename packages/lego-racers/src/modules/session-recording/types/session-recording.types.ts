import type { BuiltCar } from '../../racer-setup/index.ts'
import type { SaveRacer } from '../../save-data/index.ts'
import type { RaceMenuInput } from '../../race/index.ts'
import type { RaceInputSnapshot } from '../../race-input/index.ts'

// A local player's car as the session had it: the save's record and the design the builder holds (as the save stores it).
export type ReplayPlayerRacer = {
  readonly record: SaveRacer
  readonly designBytes: readonly number[] | null
}

// Everything that loads the race: the settings the front end filled, the race, the cars and the random cursor.
export type ReplayHeader = {
  readonly format: string
  readonly version: number
  readonly raceFolder: string
  readonly circuitName: string
  // The driver codes of the circuit; null lets the race folder's circuit decide.
  readonly racerCodes: readonly string[] | null
  readonly racerCount: number
  readonly localPlayerCount: number
  readonly raceModeFlags: number
  // The random table cursor (0x004c6ee4) the race loads with.
  readonly randomPosition: number
  readonly isMirrored: boolean
  readonly multiplayerLapCount: number
  readonly isPointsRecordPresent: boolean
  readonly isCountdownSkipped: boolean
  readonly playerCars: readonly BuiltCar[]
  readonly playerRacers: readonly ReplayPlayerRacer[]
}

// A power-up the developer keys handed racer 0 before the frame.
export type ReplayGrant = {
  readonly kind: number
  readonly level: number
}

// One frame the race step received: the integer frame time and the input state.
export type ReplayFrame = {
  readonly milliseconds: number
  readonly input: RaceInputSnapshot
  readonly menu: RaceMenuInput | null
  readonly grant: ReplayGrant | null
}

export type SessionRecording = {
  readonly header: ReplayHeader
  readonly frames: readonly ReplayFrame[]
}

// Collects the frames of one race run.
export type ReplayRecorder = {
  readonly addFrame: (frame: ReplayFrame) => void
  readonly getFrameCount: () => number
  readonly finish: () => SessionRecording
}

// The frames the original can be fed (keyboard only, no menu keys, no developer grants) and where they end.
export type ReplayScenarioSplit = {
  readonly supportedFrameCount: number
  // Why frame `supportedFrameCount` is not fed to the original; null when every frame is.
  readonly stopReason: string | null
}
