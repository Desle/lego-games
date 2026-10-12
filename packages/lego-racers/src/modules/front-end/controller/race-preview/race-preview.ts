import type { CinemaSource } from '../../types/front-end.types.ts'
import type { RacePreviewClock } from '../../types/race-preview.types.ts'

// The cinema of the race selects (0x0047a2b0, 0x00488010).
export const RACE_PREVIEW_SOURCE: CinemaSource = Object.freeze({
  directory: 'SINGRACE',
  fileName: 'PST',
})

// 0x0047a2b0 sets the race timer to 2,000 ms whenever it shows a race.
const RACE_CYCLE_MILLISECONDS = 2000
// 0x004881a0 sets the best time's countdown (screen +0x2e08) to 0x9c4 whenever it shows a time.
const BEST_TIME_SWAP_MILLISECONDS = 2500 // 0x9c4 at 0x00488337

export const createRacePreviewClock = (): RacePreviewClock =>
  Object.freeze({
    remainingMilliseconds: RACE_CYCLE_MILLISECONDS,
    cycleCount: 0,
    cinemaMilliseconds: 0,
    bestTimeRemainingMilliseconds: BEST_TIME_SWAP_MILLISECONDS,
    isBestLapShown: true,
  })

// 0x00487b50 and 0x00488010 (the race on show changed): the lap time shows first (+0x2e10 = 1) and the countdown restarts at
// 2,500 ms without taking the frame off.
export const restartBestTimeClock = (clock: RacePreviewClock): RacePreviewClock =>
  Object.freeze({
    ...clock,
    bestTimeRemainingMilliseconds: BEST_TIME_SWAP_MILLISECONDS,
    isBestLapShown: true,
  })

// 0x00488150, once per frame: a countdown smaller than the frame's time swaps the lap time and the race time (0x004881a0 restarts the
// countdown at 2,500 ms without taking the frame off); any other frame takes its time off.
const advanceBestTimeClock = (
  clock: RacePreviewClock,
  frameMilliseconds: number
): Pick<RacePreviewClock, 'bestTimeRemainingMilliseconds' | 'isBestLapShown'> =>
  clock.bestTimeRemainingMilliseconds < frameMilliseconds
    ? {
        bestTimeRemainingMilliseconds: BEST_TIME_SWAP_MILLISECONDS,
        isBestLapShown: !clock.isBestLapShown,
      }
    : {
        bestTimeRemainingMilliseconds: clock.bestTimeRemainingMilliseconds - frameMilliseconds,
        isBestLapShown: clock.isBestLapShown,
      }

// 0x0047a3f0, once per frame: a timer smaller than the frame's time switches to the next race (0x0047a2b0: the timer
// restarts at 2,000 ms without taking the frame off, and the new cinema starts at 0); any other frame takes its time off
// the timer and advances the cinema. A screen that does not cycle (the single race screen, the last circuit) only advances.
export const advanceRacePreviewClock = (
  clock: RacePreviewClock,
  frameMilliseconds: number,
  isCycling: boolean
): RacePreviewClock =>
  isCycling && clock.remainingMilliseconds < frameMilliseconds
    ? Object.freeze({
        remainingMilliseconds: RACE_CYCLE_MILLISECONDS,
        cycleCount: clock.cycleCount + 1,
        cinemaMilliseconds: 0,
        ...advanceBestTimeClock(clock, frameMilliseconds),
      })
    : Object.freeze({
        remainingMilliseconds: isCycling
          ? clock.remainingMilliseconds - frameMilliseconds
          : clock.remainingMilliseconds,
        cycleCount: clock.cycleCount,
        cinemaMilliseconds: clock.cinemaMilliseconds + frameMilliseconds,
        ...advanceBestTimeClock(clock, frameMilliseconds),
      })
