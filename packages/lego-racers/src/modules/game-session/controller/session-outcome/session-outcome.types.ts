import type { SaveFile, SaveProfile } from '../../../save-data/index.ts'

export type TimeRecordApplication = {
  readonly profile: SaveProfile
  // The ghost of the race was beaten for the first time.
  readonly isChampionBeaten: boolean
  // The menu screen to open instead of the session's (0x1c once the twelfth ghost is beaten), or null.
  readonly resultScreen: number | null
}

export type CircuitResultApplication = {
  readonly saveFile: SaveFile
  readonly isRankRecorded: boolean
  readonly isTrophyAwarded: boolean
  // The key of the circuit the result unlocked (settings → front end flag 4), or null.
  readonly unlockedCircuitName: string | null
}

export type SessionSaveOutcome = {
  readonly saveFile: SaveFile
  // The menu screen to open: the session's, or 0x1c once the twelfth champion is beaten.
  readonly resultScreen: number
}
