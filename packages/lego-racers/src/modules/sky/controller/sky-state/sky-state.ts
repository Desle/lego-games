import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import { SkyStateError } from '../../types/sky-errors/sky-errors.ts'
import type {
  ByteTriple,
  Sky,
  SkyKeyframe,
  SkyRingColors,
  SkySettingProgress,
  SkyState,
} from '../../types/sky.types.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)

const UNSIGNED_MODULUS = 0x1_0000_0000
const BYTE_MASK = 0xff
const INTEGER_OVERFLOW = -0x8000_0000

const getUnsigned = (value: number): number => value >>> 0

// `_ftol` (0x004a84b0) followed by a byte store: a value that does not fit 32 bits becomes 0x80000000.
const getTruncatedByte = (value: number): number => {
  const truncated = Math.trunc(value)
  const integer =
    Number.isFinite(truncated) && truncated >= INTEGER_OVERFLOW && truncated < -INTEGER_OVERFLOW
      ? truncated
      : INTEGER_OVERFLOW
  return (integer + UNSIGNED_MODULUS) & BYTE_MASK
}

// 0x0041cf20: `ftol(from · (1 - t) + to · t)` for each channel, in the FPU's working precision.
const getBlendedTriple = (from: ByteTriple, to: ByteTriple, fraction: number): ByteTriple => {
  const complement = arithmetic.subtract(1, fraction)
  const getChannel = (index: number): number =>
    getTruncatedByte(
      arithmetic.add(
        arithmetic.multiply(from[index] ?? 0, complement),
        arithmetic.multiply(to[index] ?? 0, fraction)
      )
    )
  return Object.freeze([getChannel(0), getChannel(1), getChannel(2)] as const)
}

// Ring 0 takes keyframe bytes +0x0c, ring 1 +0x08 and ring 2 +0x04 (0x0041cfc0 reads its arguments last first).
const getRingTriples = (keyframe: SkyKeyframe): SkyRingColors =>
  Object.freeze([keyframe.thirdBytes, keyframe.secondBytes, keyframe.firstBytes] as const)

const getBlendedRingColors = (
  from: SkyRingColors,
  to: SkyRingColors,
  fraction: number
): SkyRingColors =>
  Object.freeze([
    getBlendedTriple(from[0], to[0], fraction),
    getBlendedTriple(from[1], to[1], fraction),
    getBlendedTriple(from[2], to[2], fraction),
  ] as const)

const getFraction = (elapsedMilliseconds: number, durationMilliseconds: number): number =>
  arithmetic.storeFloat(arithmetic.divide(elapsedMilliseconds | 0, durationMilliseconds | 0))

// 0x0041ce60: a setting with one keyframe is that keyframe; otherwise the current keyframe blended towards the
// next (wrapping) by elapsed time over the current keyframe's duration.
const getSettingColors = (state: SkyState, settingIndex: number): SkyRingColors => {
  const setting = state.sky.settings[settingIndex]
  const progress = state.progress[settingIndex]
  const keyframe = setting?.keyframes[progress?.keyframeIndex ?? 0]
  if (setting === undefined || progress === undefined || keyframe === undefined) {
    throw new SkyStateError(`Sky setting ${String(settingIndex)} has no current keyframe`)
  }
  if (setting.keyframes.length === 1) return getRingTriples(keyframe)
  const nextKeyframe = setting.keyframes[(progress.keyframeIndex + 1) % setting.keyframes.length]
  if (nextKeyframe === undefined) {
    throw new SkyStateError(`Sky setting ${String(settingIndex)} has no next keyframe`)
  }
  const fraction = getFraction(progress.elapsedMilliseconds, keyframe.integer)
  const from = getRingTriples(keyframe)
  const to = getRingTriples(nextKeyframe)
  return getBlendedRingColors(from, to, fraction)
}

// 0x0041ccb0 for one setting: time advances by `delta` and, once it passes the keyframe's duration, the next
// keyframe starts from 0 (the overshoot is dropped).
const getAdvancedProgress = (
  sky: Sky,
  settingIndex: number,
  progress: SkySettingProgress,
  deltaMilliseconds: number
): SkySettingProgress => {
  const elapsed = getUnsigned(progress.elapsedMilliseconds + deltaMilliseconds)
  const keyframeCount = sky.settings[settingIndex]?.keyframes.length ?? 1
  const duration = getUnsigned(
    sky.settings[settingIndex]?.keyframes[progress.keyframeIndex]?.integer ?? 0
  )
  if (elapsed <= duration) return Object.freeze({ ...progress, elapsedMilliseconds: elapsed })
  return Object.freeze({
    elapsedMilliseconds: 0,
    keyframeIndex: (progress.keyframeIndex + 1) % keyframeCount,
  })
}

// The sky after `Sky_Load` (0x0041c550): every setting at its first keyframe, the setting the file names (index 0
// when absent or unknown) current, no transition.
export const createSkyState = (sky: Sky): SkyState => {
  if (sky.settings.length === 0 || sky.settings.some((setting) => setting.keyframes.length === 0)) {
    throw new SkyStateError('A sky needs at least one setting and every setting a keyframe')
  }
  const selectedIndex = sky.settings.findIndex(
    (setting) => setting.name === sky.selectedSettingName
  )
  return Object.freeze({
    sky,
    progress: Object.freeze(
      sky.settings.map(() => Object.freeze({ elapsedMilliseconds: 0, keyframeIndex: 0 }))
    ),
    currentSettingIndex: Math.max(selectedIndex, 0),
    previousSettingIndex: 0,
    blendDurationMilliseconds: 0,
    blendElapsedMilliseconds: 0,
  })
}

// 0x0041d150: makes the named setting current, remembering the one it replaces and starting a transition of
// `durationMilliseconds` unless the setting is the current one; an unknown name does nothing.
export const switchSkySetting = (
  state: SkyState,
  name: string,
  durationMilliseconds: number
): SkyState => {
  const settingIndex = state.sky.settings.findIndex((setting) => setting.name === name)
  if (settingIndex < 0) return state
  const isSwitching = settingIndex !== state.currentSettingIndex
  return Object.freeze({
    ...state,
    previousSettingIndex: state.currentSettingIndex,
    currentSettingIndex: settingIndex,
    blendDurationMilliseconds: isSwitching ? durationMilliseconds : state.blendDurationMilliseconds,
    blendElapsedMilliseconds: isSwitching ? 0 : state.blendElapsedMilliseconds,
  })
}

// Sky_Update (0x0041ccb0), the part that moves time: every setting advances, and a transition ends once its
// elapsed time passes its duration.
export const advanceSky = (state: SkyState, deltaMilliseconds: number): SkyState => {
  const blendElapsed =
    state.blendDurationMilliseconds === 0
      ? state.blendElapsedMilliseconds
      : getUnsigned(state.blendElapsedMilliseconds + deltaMilliseconds)
  const isBlendFinished =
    state.blendDurationMilliseconds !== 0 &&
    blendElapsed > getUnsigned(state.blendDurationMilliseconds)
  return Object.freeze({
    ...state,
    progress: Object.freeze(
      state.progress.map((progress, settingIndex) =>
        getAdvancedProgress(state.sky, settingIndex, progress, deltaMilliseconds)
      )
    ),
    blendDurationMilliseconds: isBlendFinished ? 0 : state.blendDurationMilliseconds,
    blendElapsedMilliseconds: isBlendFinished ? 0 : blendElapsed,
  })
}

// Sky_Update's colours: the current setting's, blended from the previous setting's while a transition runs
// (0x0041cdb1..0x0041ce30; the previous setting is the "from" colour).
export const getSkyRingColors = (state: SkyState): SkyRingColors => {
  const current = getSettingColors(state, state.currentSettingIndex)
  if (state.blendDurationMilliseconds === 0) return current
  const previous = getSettingColors(state, state.previousSettingIndex)
  const fraction = getFraction(state.blendElapsedMilliseconds, state.blendDurationMilliseconds)
  return getBlendedRingColors(previous, current, fraction)
}
