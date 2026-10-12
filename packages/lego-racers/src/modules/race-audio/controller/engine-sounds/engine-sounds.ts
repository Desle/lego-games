import { getFloatFromBits } from '../../../simulation-math/index.ts'
import { getSoundLocation } from '../get-sound-location/get-sound-location.ts'
import type {
  EngineLoop,
  EngineLoopKind,
  EngineModeChoice,
  EngineSoundInput,
  EngineSoundState,
  EngineSoundStep,
} from './engine-sounds.types.ts'

// The sound ids the racer constructor 0x00437540 asks the sound player for (0x00443bd0).
const LOOP_SOUND_IDS: Readonly<Record<EngineLoopKind, number>> = Object.freeze({
  idle: 0x20,
  middle: 10,
  high: 0x3d,
  skid: 3,
})

const IDLE_SPEED_LIMIT = getFloatFromBits(0x3c75c28f) // 0x004b0988, 0.015
const LOUD_FADE = getFloatFromBits(0x3f333333) // 0x004b098c, 0.7
const QUIET_FADE = 0.5 // 0x004b0990
const FADE_RATE = getFloatFromBits(0x3d75c28f) // 0x004b0998
const FADE_SCALE = getFloatFromBits(0x3cf5c29f) // 0x004b099c
const IDLE_FADE_IN = 1.5 // 0x004b09d0
const CURVE_ANGLE_SCALE = getFloatFromBits(0x400f9d9c) // 0x004b0994
const SPEED_SCALE = getFloatFromBits(0x3e2e147b) // 0x004b0954, 0.17
const PITCH_BASE = getFloatFromBits(0x3ecccccd) // 0x004b094c, 0.4
const PITCH_AIRBORNE = getFloatFromBits(0x3dcccccd) // 0x004b0950, 0.1
const AIRBORNE_MILLISECONDS = 0x32
const SKID_SPEED = getFloatFromBits(0x3c23d70a) // 0x004b09a0, 0.01

export const INITIAL_ENGINE_SOUND_STATE: EngineSoundState = Object.freeze({
  mode: 0,
  fades: Object.freeze([0, 0, 0] as const),
  isPlaying: Object.freeze([true, false, false] as const),
  isSkidPlaying: false,
})

const getClamped = (value: number): number => Math.min(Math.max(value, 0), 1)

// 0x00437d40: which of the three loops the racer's state asks for, and the mode it switches to when that loop is not
// playing (a loop that is playing keeps the mode, so the engine waits for the loop it is in to fade out).
const getModeAfterChoice = (state: EngineSoundState, input: EngineSoundInput): EngineModeChoice => {
  const isCoasting = input.throttle === 0 && !input.isDriverThrottling
  const wanted: 0 | 1 | 2 = isCoasting ? (input.speed <= IDLE_SPEED_LIMIT ? 0 : 2) : 1
  if (state.isPlaying[wanted]) return { mode: state.mode, isPlaying: state.isPlaying }
  return {
    mode: wanted,
    isPlaying: [wanted === 0, wanted === 1, wanted === 2],
  }
}

// The fades move by `rate` towards the chosen loop and away from the others, each between 0 and the limit.
const getFades = (
  fades: readonly [number, number, number],
  mode: 0 | 1 | 2,
  rate: number,
  limit: number
): readonly [number, number, number] => {
  const next = fades.map((fade, index) => {
    if (index === mode) {
      const rise = mode === 0 ? rate * IDLE_FADE_IN : rate
      return Math.min(fade < limit ? Math.fround(fade + rise) : fade, limit)
    }
    return fade <= rate ? 0 : Math.fround(fade - rate)
  })
  return [next[0] ?? 0, next[1] ?? 0, next[2] ?? 0]
}

const getVolume = (fade: number, limit: number): number =>
  fade === limit ? limit : Math.fround(Math.sin(fade * CURVE_ANGLE_SCALE) * limit)

const createLoop = (
  kind: EngineLoopKind,
  isPlaying: boolean,
  volume: number,
  pitch: number
): EngineLoop =>
  Object.freeze({
    kind,
    soundId: LOOP_SOUND_IDS[kind],
    location: getSoundLocation(LOOP_SOUND_IDS[kind]),
    isPlaying,
    volume,
    pitch,
  })

// 0x00437d40 (every step of every racer, `stepMilliseconds` the step): the three engine loops crossfade by what the
// racer does, their pitch follows the speed, and a braking racer that still moves starts the skid (sound 2 once, then
// the loop 3). Nothing runs while racer flag 0x400 is clear.
export const stepEngineSounds = (
  state: EngineSoundState,
  input: EngineSoundInput,
  stepMilliseconds: number
): EngineSoundStep => {
  if (!input.isRunning)
    return Object.freeze({ state, loops: Object.freeze([]), isSkidStarted: false })
  const choice = getModeAfterChoice(state, input)
  const limit = input.isQuiet ? QUIET_FADE : LOUD_FADE
  const rate = Math.fround(Math.fround(stepMilliseconds * FADE_SCALE) * FADE_RATE)
  const fades = getFades(state.fades, choice.mode, rate, limit)
  const isPlaying: readonly [boolean, boolean, boolean] = [
    fades[0] === 0 ? false : choice.isPlaying[0],
    fades[1] === 0 ? false : choice.isPlaying[1],
    fades[2] === 0 ? false : choice.isPlaying[2],
  ]
  const speedShare = Math.fround(input.speed / SPEED_SCALE)
  const scaled = Math.fround(speedShare * input.engineSoundValue)
  const middlePitch = Math.fround(
    Math.fround(Math.fround(1 - PITCH_BASE - PITCH_AIRBORNE) * scaled) + PITCH_BASE
  )
  const highPitch = Math.fround(Math.fround(Math.fround(1 - PITCH_BASE) * scaled) + PITCH_BASE)
  const isBraking = input.throttle < 0
  const isSkidStarted = !state.isSkidPlaying && SKID_SPEED < input.forwardSpeed && isBraking
  const isSkidPlaying = state.isSkidPlaying
    ? SKID_SPEED <= input.forwardSpeed && isBraking
    : isSkidStarted
  const skidPitch = Math.fround(1 - Math.fround(SPEED_SCALE - input.speed))
  return Object.freeze({
    state: Object.freeze({ mode: choice.mode, fades, isPlaying, isSkidPlaying }),
    loops: Object.freeze([
      createLoop(
        'idle',
        isPlaying[0],
        getVolume(fades[0], limit),
        getClamped(input.engineSoundValue)
      ),
      createLoop(
        'middle',
        isPlaying[1],
        getVolume(fades[1], limit),
        getClamped(
          input.airborneMilliseconds > AIRBORNE_MILLISECONDS
            ? Math.fround(middlePitch + PITCH_AIRBORNE)
            : middlePitch
        )
      ),
      createLoop('high', isPlaying[2], getVolume(fades[2], limit), getClamped(highPitch)),
      createLoop('skid', isSkidPlaying, 1, skidPitch),
    ]),
    isSkidStarted,
  })
}
