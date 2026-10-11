import type { FrameClock, FrameClockAdvance } from '../../types/frame-clock.types.ts'

// Application +0x828, set by 0x004162c0: a frame never lasts longer than this many milliseconds.
export const MAXIMUM_FRAME_MILLISECONDS = 100

// 0x00416ef0 sleeps `12 - delta` when the delta is below 12, so a frame is never shorter than this.
export const MINIMUM_FRAME_MILLISECONDS = 12

export const createFrameClock = (): FrameClock => Object.freeze({ lastMilliseconds: null })

// Application_PumpMessagesAndMeasureFrame 0x00416ef0 turned into a poll: `timeGetTime()` is whole milliseconds,
// the delta is capped at 100 and a delta under 12 is slept off and re-measured. A browser cannot sleep, so a
// poll that finds less than 12 ms has passed returns no frame and leaves the clock alone; the next poll then
// measures from the same last time, exactly as the re-measure after the sleep does.
export const advanceFrameClock = (
  clock: FrameClock,
  nowMilliseconds: number
): FrameClockAdvance => {
  const now = Math.floor(nowMilliseconds)
  if (clock.lastMilliseconds === null) {
    return Object.freeze({
      clock: Object.freeze({ lastMilliseconds: now }),
      frameMilliseconds: null,
    })
  }
  const delta = now - clock.lastMilliseconds
  if (delta < MINIMUM_FRAME_MILLISECONDS) return Object.freeze({ clock, frameMilliseconds: null })
  return Object.freeze({
    clock: Object.freeze({ lastMilliseconds: now }),
    frameMilliseconds: Math.min(delta, MAXIMUM_FRAME_MILLISECONDS),
  })
}
