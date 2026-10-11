import type { RaceTimeRecord } from '../../types/game-session.types.ts'
import type { TimedRacer } from './race-times.types.ts'

const NO_TIME = 0xffffffff

// FUN_0043beb0 (called when a race ends and by the pause menu's restart): among the human racers that finished all
// their laps, the fastest single lap and the lowest total are folded into the slot's record. A time replaces the
// stored one when none is stored or it is not larger. Both records name the racer with the fastest lap (`local_c`),
// as the original does, not the racer with the lowest total.
export const recordRaceTimes = (
  record: RaceTimeRecord,
  racers: readonly TimedRacer[],
  humanRacerIndices: readonly number[]
): RaceTimeRecord => {
  let bestLap = NO_TIME
  let bestLapRacerIndex = 0
  let bestRace = NO_TIME
  humanRacerIndices.forEach((racerIndex) => {
    const racer = racers[racerIndex]
    if (racer === undefined || racer.lapCount > racer.currentLap) return
    const laps = racer.lapMilliseconds.slice(0, racer.lapCount)
    laps.forEach((milliseconds) => {
      if (milliseconds < bestLap) {
        bestLap = milliseconds
        bestLapRacerIndex = racerIndex
      }
    })
    const total = laps.reduce((sum, milliseconds) => (sum + milliseconds) >>> 0, 0)
    if (total < bestRace) bestRace = total
  })
  const isLapStored = bestLap !== NO_TIME
  const isRaceStored = bestRace !== NO_TIME
  const isLapKept =
    isLapStored && (record.bestLapMilliseconds === 0 || bestLap <= record.bestLapMilliseconds)
  const isRaceKept =
    isRaceStored && (record.bestRaceMilliseconds === 0 || bestRace <= record.bestRaceMilliseconds)
  return Object.freeze({
    bestLapMilliseconds: isLapKept ? bestLap : record.bestLapMilliseconds,
    bestLapRacerIndex: isLapKept ? bestLapRacerIndex : record.bestLapRacerIndex,
    bestRaceMilliseconds: isRaceKept ? bestRace : record.bestRaceMilliseconds,
    bestRaceRacerIndex: isRaceKept ? bestLapRacerIndex : record.bestRaceRacerIndex,
  })
}
