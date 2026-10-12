import { createFigure, playFigureAnimation, updateFigure } from '../../../racer/index.ts'
import type { Figure } from '../../../racer/index.ts'
import {
  advanceSkeletonInstance,
  startSkeletonInstanceClip,
} from '../../../world-animation/index.ts'
import type { SkeletonInstanceRuntime } from '../../../world-animation/index.ts'
import {
  getQuaternionFromMatrix,
  getTruncatedInteger,
  type FloatArithmetic,
} from '../../../simulation-math/index.ts'
import { getSignedShort, getUnsignedByte } from '../../../../shared/binary-values/binary-values.ts'
import {
  BEST_DRIVER_ANIMATION,
  CHAMPION_DRIVER_CLIP,
  GHOST_LAP_COUNT,
  MAXIMUM_RECORDED_SAMPLE_COUNT,
  ORIENTATION_SCALE,
  POSITION_SCALE,
  SAMPLE_INTERVAL_MILLISECONDS,
} from '../../types/ghost-constants/ghost-constants.ts'
import type { Ghost, GhostSample } from '../../types/ghost.types.ts'
import type {
  GhostBestCar,
  GhostPose,
  GhostRun,
  GhostSession,
} from '../../types/ghost-run/ghost-run.types.ts'

const NO_LAP_TIMES: readonly number[] = Object.freeze(new Array<number>(GHOST_LAP_COUNT).fill(0))

// The zeroed buffer FUN_00422420 and FUN_004234f0 leave.
export const EMPTY_GHOST_RUN: GhostRun = Object.freeze({
  lapMilliseconds: NO_LAP_TIMES,
  samples: Object.freeze([]),
  secondInteger: 0,
  startPosition: Object.freeze([0, 0, 0] as const),
  startQuaternion: Object.freeze([0, 0, 0, 0] as const),
})

// The buffer Ghost_Load 0x00423160 fills; keywords the file leaves out keep the zeros.
export const getGhostRun = (ghost: Ghost): GhostRun =>
  Object.freeze({
    lapMilliseconds: ghost.firstIntegers ?? NO_LAP_TIMES,
    samples: ghost.samples,
    secondInteger: ghost.secondInteger ?? 0,
    startPosition: ghost.startPosition ?? EMPTY_GHOST_RUN.startPosition,
    startQuaternion: ghost.startQuaternion ?? EMPTY_GHOST_RUN.startQuaternion,
  })

const getChanged = (session: GhostSession, changes: Partial<GhostSession>): GhostSession =>
  Object.freeze({ ...session, ...changes })

const getLapTotal = (run: GhostRun): number =>
  run.lapMilliseconds.reduce((total, milliseconds) => (total + milliseconds) >>> 0, 0)

// FUN_00422420 (Ghost_Init): all three buffers zero, the clocks at 0, the mirror flag from the first race's
// settings (+0x3c). The ghost car's models are the viewer's business.
export const createGhostSession = (isMirrored: boolean): GhostSession =>
  Object.freeze({
    championRun: null,
    bestRun: null,
    currentRun: EMPTY_GHOST_RUN,
    elapsedMilliseconds: 0,
    sampleTimerMilliseconds: 0,
    isRunning: false,
    isBestRunShown: false,
    isRunFinished: false,
    isMirrored,
    isChampionPlaybackFinished: false,
    isBestPlaybackFinished: false,
    championCar: null,
    bestCar: null,
  })

// The rest of Ghost_Initialize (0x00422420): the champion's car is the `ghost2` and `ghostdr` skeleton instances of the
// `ghost` world; `FUN_0040dad0(driver, 0xc)` starts the driver's clip 12, looping. The wheels keep the clip the world's
// keyword 0x35 started (flags 0x50001 at the first frame).
export const loadGhostCar = (
  session: GhostSession,
  instances: { readonly wheels: SkeletonInstanceRuntime; readonly driver: SkeletonInstanceRuntime }
): GhostSession =>
  getChanged(session, {
    championCar: Object.freeze({
      wheels: instances.wheels,
      driver: startSkeletonInstanceClip(instances.driver, CHAMPION_DRIVER_CLIP, 0),
    }),
  })

// FUN_00422de0, from Race_LoadRaceDescription: the champion ghost of the race is loaded (null for a race without
// GHOST.GHB or with no samples: flag 0x08 clear), the clock and the recording are cleared. The sample timer is not
// touched, so it carries over from the previous run.
export const loadChampionGhost = (session: GhostSession, champion: Ghost | null): GhostSession => {
  const run = champion === null ? null : getGhostRun(champion)
  return getChanged(session, {
    championRun: run !== null && run.samples.length !== 0 ? run : null,
    elapsedMilliseconds: 0,
    isRunning: false,
    currentRun: EMPTY_GHOST_RUN,
    isChampionPlaybackFinished: false,
    isBestPlaybackFinished: false,
  })
}

// FUN_004234f0 (the pause menu's restart): the same clearing without reloading the champion.
export const restartGhostRun = (session: GhostSession): GhostSession =>
  getChanged(session, {
    elapsedMilliseconds: 0,
    isRunning: false,
    currentRun: EMPTY_GHOST_RUN,
    isChampionPlaybackFinished: false,
    isBestPlaybackFinished: false,
  })

// 0x00422eb0 with flag 0x01: the wheels and the driver of the first local racer are bound anew (0x0040d550) to the same models
// and animations, and the driver starts animation 13 (0x0040dad0).
const getBestCar = (playerFigures: {
  readonly wheels: Figure
  readonly driver: Figure
}): GhostBestCar => {
  const getCopy = (figure: Figure): Figure => createFigure(figure.animations, figure.child)
  return Object.freeze({
    wheels: getCopy(playerFigures.wheels),
    driver: playFigureAnimation(getCopy(playerFigures.driver), BEST_DRIVER_ANIMATION),
  })
}

// FUN_00422eb0, from Race_UpdateState2 when the countdown ends: the clock runs; a run finished earlier in the
// session plays beside the champion.
export const beginGhostRun = (
  session: GhostSession,
  playerFigures: { readonly wheels: Figure; readonly driver: Figure } | null = null
): GhostSession =>
  getChanged(session, {
    isRunning: true,
    isBestRunShown: session.isRunFinished,
    bestCar:
      session.isRunFinished && playerFigures !== null ? getBestCar(playerFigures) : session.bestCar,
  })

const getRecordedSample = (arithmetic: FloatArithmetic, pose: GhostPose): GhostSample => {
  const { x, y, z } = pose.position
  const quaternion = getQuaternionFromMatrix(arithmetic, pose.rotation)
  const getPosition = (value: number): number =>
    getSignedShort(getTruncatedInteger(arithmetic.multiply(POSITION_SCALE, value)))
  const getOrientation = (value: number): number =>
    getUnsignedByte(getTruncatedInteger(arithmetic.multiply(ORIENTATION_SCALE, value)))
  return Object.freeze({
    position: Object.freeze([getPosition(x), getPosition(y), getPosition(z)] as const),
    orientationBytes: Object.freeze([
      getOrientation(quaternion.x),
      getOrientation(quaternion.y),
      getOrientation(quaternion.z),
      getOrientation(quaternion.w),
    ]),
  })
}

// The first half of GhostRecorder_RecordSample: the cars' figures and skeleton instances advance by the step through their
// update slot (+0x10): the best run's copies with flag 0x01, the champion's instances with flag 0x08 (a champion loaded).
const getAdvancedCars = (
  arithmetic: FloatArithmetic,
  session: GhostSession,
  stepMilliseconds: number
): Pick<GhostSession, 'championCar' | 'bestCar'> => {
  const { bestCar, championCar } = session
  return {
    bestCar:
      session.isBestRunShown && bestCar !== null
        ? Object.freeze({
            wheels: updateFigure(arithmetic, bestCar.wheels, stepMilliseconds),
            driver: updateFigure(arithmetic, bestCar.driver, stepMilliseconds),
          })
        : bestCar,
    championCar:
      session.championRun !== null && championCar !== null
        ? Object.freeze({
            wheels: advanceSkeletonInstance(championCar.wheels, stepMilliseconds),
            driver: advanceSkeletonInstance(championCar.driver, stepMilliseconds),
          })
        : championCar,
  }
}

// GhostRecorder_RecordSample 0x00422710, called with every sub-step of Race_Update. While the clock runs it adds the
// step; when the sample timer is used up it takes a sample (position · 32 and 127 · quaternion, truncated) and
// restarts the timer at 250 ms less the overshoot. The first sample also keeps the full position and quaternion.
export const recordGhostSample = (
  arithmetic: FloatArithmetic,
  session: GhostSession,
  stepMilliseconds: number,
  pose: GhostPose
): GhostSession => {
  if (!session.isRunning) return session
  const elapsed = (session.elapsedMilliseconds + stepMilliseconds) >>> 0
  const clocked = getChanged(session, {
    elapsedMilliseconds: elapsed,
    ...getAdvancedCars(arithmetic, session, stepMilliseconds),
  })
  if (stepMilliseconds < session.sampleTimerMilliseconds) {
    return getChanged(clocked, {
      sampleTimerMilliseconds: session.sampleTimerMilliseconds - stepMilliseconds,
    })
  }
  const timed = getChanged(clocked, {
    sampleTimerMilliseconds:
      (session.sampleTimerMilliseconds - stepMilliseconds + SAMPLE_INTERVAL_MILLISECONDS) >>> 0,
  })
  const { currentRun } = session
  if (currentRun.samples.length >= MAXIMUM_RECORDED_SAMPLE_COUNT) return timed
  const isFirstSample = currentRun.samples.length === 0
  const quaternion = getQuaternionFromMatrix(arithmetic, pose.rotation)
  return getChanged(timed, {
    currentRun: Object.freeze({
      ...currentRun,
      samples: Object.freeze([...currentRun.samples, getRecordedSample(arithmetic, pose)]),
      startPosition: isFirstSample
        ? Object.freeze([pose.position.x, pose.position.y, pose.position.z] as const)
        : currentRun.startPosition,
      startQuaternion: isFirstSample
        ? Object.freeze([quaternion.x, quaternion.y, quaternion.z, quaternion.w] as const)
        : currentRun.startQuaternion,
    }),
  })
}

// FUN_004230e0, from Race_UpdateState3 when the human racer finishes: the racer's lap times go into the recording;
// when they add up to less than the best run's (or there is none) the recording becomes the best run. The clock
// stops (flags & 0xfc | 0x10).
export const finishGhostRun = (
  session: GhostSession,
  lapMilliseconds: readonly number[]
): GhostSession => {
  const recorded: GhostRun = Object.freeze({
    ...session.currentRun,
    lapMilliseconds: Object.freeze(lapMilliseconds.slice(0, GHOST_LAP_COUNT)),
  })
  const bestTotal = session.bestRun === null ? 0 : getLapTotal(session.bestRun)
  const isBetter = getLapTotal(recorded) < bestTotal || bestTotal === 0
  return getChanged(session, {
    bestRun: isBetter ? recorded : session.bestRun,
    currentRun: isBetter ? (session.bestRun ?? EMPTY_GHOST_RUN) : recorded,
    isRunning: false,
    isBestRunShown: false,
    isRunFinished: true,
  })
}

// FUN_004234b0, read by Race_RunLoop when the race ends: with a champion ghost loaded and a run finished (or shown),
// the best run beats the champion when its lap times add up to less.
export const getIsChampionBeaten = (session: GhostSession): boolean => {
  if (session.championRun === null || !(session.isBestRunShown || session.isRunFinished)) {
    return false
  }
  const bestTotal = session.bestRun === null ? 0 : getLapTotal(session.bestRun)
  return bestTotal < getLapTotal(session.championRun)
}
