import { getBitsFromFloat } from '../../../../shared/emulator/float-bits.ts'
import { getFloatWords, getVectorWords } from '../trace-words/trace-words.ts'
import type { RouteFollower } from '../../../racer-ai/index.ts'
import type { Racer, RacerSet } from '../../../racer/index.ts'
import type { Quaternion } from '../../../simulation-math/index.ts'
import type { TraceFields } from '../../types/golden-trace.types.ts'

const getQuaternionWords = (quaternion: Quaternion): readonly number[] =>
  getFloatWords([quaternion.x, quaternion.y, quaternion.z, quaternion.w])

const getIntegerWords = (...values: readonly number[]): readonly number[] =>
  values.map((value) => value >>> 0)

const getPackedWord = (bytes: readonly number[], start: number): number =>
  [0, 1, 2, 3].reduce(
    (word, index) => (word | ((bytes[start + index] ?? 0) << (8 * index))) >>> 0,
    0
  )

// Follower +0x00..+0x27 (the route pointer at +0x28 is not compared).
const getFollowerPoseWords = (follower: RouteFollower): readonly number[] => [
  ...getVectorWords(follower.position),
  ...getQuaternionWords(follower.rotation),
  ...getIntegerWords(follower.contactState),
  ...getFloatWords([follower.negativeLateralLimit, follower.positiveLateralLimit]),
]

// Follower +0x2c..+0x77.
const getFollowerPlaybackWords = (follower: RouteFollower): readonly number[] => [
  ...getFloatWords([follower.speedFactor, follower.time]),
  ...getIntegerWords(follower.previousSampleIndex, follower.nextSampleIndex),
  ...getVectorWords(follower.previousPosition),
  ...getVectorWords(follower.nextPosition),
  ...getQuaternionWords(follower.previousRotation),
  ...getQuaternionWords(follower.nextRotation),
  ...getIntegerWords(follower.previousTime),
]

const getZeroWords = (count: number): readonly number[] => Array.from({ length: count }, () => 0)

// The fields of golden_trace.py's COMPUTER_RACER_FIELDS and the rubber band, for one racer.
const getComputerRacerFields = (racer: Racer, index: number): TraceFields => {
  const prefix = `racer${String(index)}`
  const { carBody } = racer
  const { routeFollower } = carBody
  return {
    [`${prefix}.follower.pose`]:
      routeFollower === null ? getZeroWords(10) : getFollowerPoseWords(routeFollower),
    [`${prefix}.follower.playback`]:
      routeFollower === null ? getZeroWords(19) : getFollowerPlaybackWords(routeFollower),
    [`${prefix}.scripted.state`]: getIntegerWords(
      carBody.isScripted ? 1 : 0,
      carBody.isRouteHeld ? 1 : 0
    ),
    [`${prefix}.scripted.speed`]: [
      ...getFloatWords([carBody.speedFactor]),
      ...getFloatWords([carBody.rampMilliseconds]),
    ],
    [`${prefix}.scripted.motion`]: getFloatWords([
      carBody.bounceHeight,
      carBody.lateralOffset,
      carBody.bounceVerticalSpeed,
      carBody.scriptedSpinPeriod,
      carBody.scriptedSpinTime,
      carBody.flipRate,
      carBody.flipAngle,
      carBody.flipHeight,
      carBody.defaultTargetSpeedFactor,
      carBody.targetSpeedFactor,
    ]),
    [`${prefix}.ai.personality`]: getIntegerWords(
      getPackedWord(racer.powerUpChances, 0),
      getPackedWord(racer.powerUpChances, 4) & 0xffff
    ),
    [`${prefix}.ai.timers`]: getIntegerWords(racer.proximityCheckMilliseconds),
    [`${prefix}.ai.voice`]: getIntegerWords(racer.voiceBase, racer.voiceMilliseconds),
  }
}

export const getComputerTraceFields = (racerSet: RacerSet): TraceFields => ({
  ...racerSet.racers.reduce<TraceFields>(
    (fields, racer, index) => ({ ...fields, ...getComputerRacerFields(racer, index) }),
    {}
  ),
  'race.rubberBand': [
    racerSet.rubberBand.countdownMilliseconds >>> 0,
    getBitsFromFloat(racerSet.rubberBand.bias),
  ],
})
