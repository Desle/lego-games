import type { RacerSet } from '../../../racer/index.ts'

// 0x0043cda0 with racer set +0x178 null (a race without a recorded lap record): how far the racer that has
// completed the same laps is ahead, in milliseconds (signed 32-bit sums of the lap times, +0xcec..). The
// leader gets 0. `lapCount` is racer set +0x29c.
export const getLapGapMilliseconds = (
  racerSet: RacerSet,
  racerIndex: number,
  lapCount: number
): number => {
  const racer = racerSet.racers[racerIndex]
  if (racer === undefined || racer.racePosition === 1) return 0
  const completedLaps = Math.min(racer.currentLap, lapCount)
  const gaps = racerSet.racers.flatMap((other, otherIndex) => {
    const otherLaps = Math.min(other.currentLap, lapCount)
    if (otherIndex === racerIndex || completedLaps > otherLaps) return []
    const own = racer.lapMilliseconds.slice(0, completedLaps)
    const shared = own.reduce(
      (sum, milliseconds, lap) => (sum + milliseconds - (other.lapMilliseconds[lap] ?? 0)) | 0,
      0
    )
    const extra = other.lapMilliseconds
      .slice(completedLaps, otherLaps)
      .reduce((sum, milliseconds) => (sum + milliseconds) | 0, shared)
    return [extra]
  })
  return Math.max(0, ...gaps)
}
