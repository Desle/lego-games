export type RacerNameRequest = {
  readonly racerCount: number
  readonly localPlayerCount: number
  readonly isPlayerChampionCar: boolean
  readonly racerCodes: readonly string[]
  // The racer slots' names of the local players (settings slot +0x30).
  readonly playerNames: readonly string[]
}
