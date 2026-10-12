// The timers of the race select's preview (screen +0x2218 and +0x2220): the race on show, the time until the next one and
// the clock of the cinema, which restarts with each race.
export type RacePreviewClock = {
  readonly remainingMilliseconds: number
  // The races switched to since the screen opened (the race on show is this modulo the circuit's races).
  readonly cycleCount: number
  readonly cinemaMilliseconds: number
}
