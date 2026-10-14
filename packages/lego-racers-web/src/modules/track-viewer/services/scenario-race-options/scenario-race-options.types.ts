export type ScenarioRace = {
  readonly raceFolder: string
  readonly racerCodes: readonly string[]
  readonly racerCount: number
  readonly localPlayerCount: number
  readonly isMirrored: boolean
  // Game mode 2: the race has the champion's ghost.
  readonly isTimeTrial?: boolean
  // The circuit's totals the race's points record starts with (race +0x18); absent for a single race.
  readonly pointsRecordTotals?: readonly number[]
}
