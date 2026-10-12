import { getMaterialAnimationRow } from '../../../material-animation/index.ts'
import type { MaterialAnimation } from '../../../material-animation/index.ts'
import {
  createFloatArithmetic,
  getTruncatedInteger,
  RACE_FPU_PRECISION,
} from '../../../simulation-math/index.ts'
import type { MaterialAnimationPlayback } from '../../types/world-animation.types.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)

// An entry nobody has started (0x10025d40: flags 1, time 0).
export const IDLE_MATERIAL_PLAYBACK: MaterialAnimationPlayback = Object.freeze({
  isPlaying: false,
  isLooping: false,
  time: 0,
  tableIndex: null,
  target: null,
})

// 0x00410430 and GolDP.dll 0x10025da0: the entry plays, looping or not, from where its time is.
export const getStartedMaterialPlayback = (
  playback: MaterialAnimationPlayback,
  isLooping: boolean
): MaterialAnimationPlayback => Object.freeze({ ...playback, isPlaying: true, isLooping })

// 0x00410470: flags 2 and 4 clear.
export const getStoppedMaterialPlayback = (
  playback: MaterialAnimationPlayback
): MaterialAnimationPlayback => Object.freeze({ ...playback, isPlaying: false, isLooping: false })

// 0x00410480
export const getRewoundMaterialPlayback = (
  playback: MaterialAnimationPlayback
): MaterialAnimationPlayback => Object.freeze({ ...playback, time: 0 })

// 0x00410490: the time goes to the entry's last frame (its length minus one), or 0 for a length of 0.
export const getMaterialPlaybackAtLastFrame = (
  definition: MaterialAnimation,
  entryIndex: number,
  playback: MaterialAnimationPlayback
): MaterialAnimationPlayback => {
  const length = definition.entries[entryIndex]?.keyword29Value ?? 0
  return Object.freeze({ ...playback, time: length === 0 ? 0 : length - 1 })
}

// 0x004104c0: a playing entry's time grows by the milliseconds times its rate (stored as a float). A looping
// entry, or one still inside its length, selects the last table row that has started at the time modulo the
// length; a non-looping entry that reaches its length stops and rewinds.
export const getAdvancedMaterialPlayback = (
  definition: MaterialAnimation,
  entryIndex: number,
  playback: MaterialAnimationPlayback,
  milliseconds: number
): MaterialAnimationPlayback => {
  const entry = definition.entries[entryIndex]
  if (!playback.isPlaying || entry === undefined) return playback
  const time = arithmetic.storeFloat(
    arithmetic.add(arithmetic.multiply(milliseconds, entry.keyword2aValue), playback.time)
  )
  const elapsed = getTruncatedInteger(time) >>> 0
  if (!playback.isLooping && entry.keyword29Value <= elapsed) {
    return Object.freeze({ ...playback, isPlaying: false, isLooping: false, time: 0 })
  }
  return Object.freeze({
    ...playback,
    time,
    tableIndex: getMaterialAnimationRow(definition, entryIndex, elapsed),
  })
}
