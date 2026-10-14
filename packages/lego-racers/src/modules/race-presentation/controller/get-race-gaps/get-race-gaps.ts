import type { RaceGap, RaceGapRacer } from './get-race-gaps.types.ts'

// The table always has six entries; the racers' fill the first ones and the rest only get their flag cleared.
const GAP_TABLE_LENGTH = 6 // CMP ECX,0x6 at 0x0043d03b
// 0x0043d03a: a racer still on its laps gets its race position plus 0x7ffffff9 (its time is not known).
const UNFINISHED_GAP_BIAS = 0x7ffffff9
const CLEARED_GAP: RaceGap = Object.freeze({ racerIndex: null, gapMilliseconds: 0, isSet: false })

const getRaceMilliseconds = (racer: RaceGapRacer, lapCount: number): number =>
  Array.from({ length: lapCount }, (_, lap) => racer.lapMilliseconds[lap] ?? 0).reduce(
    (sum, milliseconds) => (sum + milliseconds) >>> 0,
    0
  )

// 0x0043cf30 (racer set, through 0x00439c70 from the points table 0x00440350): every racer's time behind `racerIndex`,
// the sum of its laps minus the given racer's (racer set +0x29c laps). While the given racer is still on its laps the
// racers' entries are cleared and the rest left alone; otherwise the entries past the racers lose only their flag.
export const getRaceGaps = (
  racers: readonly RaceGapRacer[],
  lapCount: number,
  racerIndex: number,
  previous: readonly RaceGap[] = []
): readonly RaceGap[] => {
  const given = racers[racerIndex]
  const getKept = (index: number, isSet: boolean): RaceGap =>
    Object.freeze({ ...(previous[index] ?? CLEARED_GAP), isSet })
  if (given === undefined || given.currentLap < lapCount) {
    return Object.freeze(
      Array.from({ length: Math.max(GAP_TABLE_LENGTH, racers.length) }, (_, index) =>
        index < racers.length ? CLEARED_GAP : getKept(index, previous[index]?.isSet ?? false)
      )
    )
  }
  const givenMilliseconds = getRaceMilliseconds(given, lapCount)
  return Object.freeze(
    Array.from({ length: Math.max(GAP_TABLE_LENGTH, racers.length) }, (_, index): RaceGap => {
      const racer = racers[index]
      if (racer === undefined) return getKept(index, false)
      if (index === racerIndex)
        return Object.freeze({ racerIndex: index, gapMilliseconds: 0, isSet: true })
      const gapMilliseconds =
        racer.currentLap < lapCount
          ? (racer.racePosition + UNFINISHED_GAP_BIAS) | 0
          : (getRaceMilliseconds(racer, lapCount) - givenMilliseconds) | 0
      return Object.freeze({ racerIndex: index, gapMilliseconds, isSet: true })
    })
  )
}
