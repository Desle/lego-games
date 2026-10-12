export type ScenarioRace = {
  readonly raceFolder: string
  readonly racerCodes: readonly string[]
  readonly racerCount: number
  readonly localPlayerCount: number
  readonly isMirrored: boolean
  // Game mode 2: the race has the champion's ghost.
  readonly isTimeTrial?: boolean
}
