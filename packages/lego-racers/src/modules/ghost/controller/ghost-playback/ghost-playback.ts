import {
  getBlendedQuaternion,
  type FloatArithmetic,
  type Quaternion,
  type Vector3,
} from '../../../simulation-math/index.ts'
import { getSignedByte } from '../../../../shared/binary-values/binary-values.ts'
import {
  MAXIMUM_PLAYBACK_MILLISECONDS,
  ORIENTATION_SCALE,
  POSITION_SCALE,
  SAMPLE_FRACTION_PER_MILLISECOND,
  SAMPLE_INTERVAL_MILLISECONDS,
  SPEED_INTERVAL_SCALE,
  SPEED_SCALE,
} from '../../types/ghost-constants/ghost-constants.ts'
import type { GhostSample } from '../../types/ghost.types.ts'
import type {
  GhostPlaybackPose,
  GhostRun,
  GhostRunSelection,
  GhostSession,
} from '../../types/ghost-run/ghost-run.types.ts'
import type { GhostPlaybackStep } from './ghost-playback.types.ts'

const getStoredPosition = (arithmetic: FloatArithmetic, sample: GhostSample): Vector3 => {
  const [x, y, z] = sample.position
  const getComponent = (value: number): number => arithmetic.divide(value, POSITION_SCALE)
  return { x: getComponent(x), y: getComponent(y), z: getComponent(z) }
}

const getStoredOrientation = (arithmetic: FloatArithmetic, sample: GhostSample): Quaternion => {
  const [x = 0, y = 0, z = 0, w = 0] = sample.orientationBytes
  const getComponent = (value: number): number =>
    arithmetic.storeFloat(arithmetic.divide(getSignedByte(value), ORIENTATION_SCALE))
  return {
    x: getComponent(x),
    y: getComponent(y),
    z: getComponent(z),
    w: getComponent(w),
  }
}

// FUN_00422960 for one run while the clock runs: the sample pair around the clock, the fraction between them
// (`remainder · 0.004f`), the position and orientation blended with it (0x004495e0) and the speed estimate stored in
// the first model. null once the clock passes the last pair.
const getPlaybackPose = (
  arithmetic: FloatArithmetic,
  run: GhostRun,
  elapsedMilliseconds: number
): GhostPlaybackPose | null => {
  const index = Math.floor(elapsedMilliseconds / SAMPLE_INTERVAL_MILLISECONDS)
  const remainder = elapsedMilliseconds - index * SAMPLE_INTERVAL_MILLISECONDS
  const from = run.samples[index]
  const to = run.samples[index + 1]
  if (from === undefined || to === undefined) return null
  const fraction = arithmetic.storeFloat(
    arithmetic.multiply(remainder, SAMPLE_FRACTION_PER_MILLISECOND)
  )
  const start = getStoredPosition(arithmetic, from)
  const end = getStoredPosition(arithmetic, to)
  const getDelta = (endValue: number, startValue: number): number =>
    arithmetic.storeFloat(arithmetic.subtract(endValue, startValue))
  const delta = {
    x: getDelta(end.x, start.x),
    y: getDelta(end.y, start.y),
    z: getDelta(end.z, start.z),
  }
  const getPosition = (deltaValue: number, startValue: number): number =>
    arithmetic.storeFloat(arithmetic.add(arithmetic.multiply(deltaValue, fraction), startValue))
  const squaredLength = arithmetic.add(
    arithmetic.add(arithmetic.multiply(delta.z, delta.z), arithmetic.multiply(delta.y, delta.y)),
    arithmetic.multiply(delta.x, delta.x)
  )
  return Object.freeze({
    position: Object.freeze({
      x: getPosition(delta.x, start.x),
      y: getPosition(delta.y, start.y),
      z: getPosition(delta.z, start.z),
    }),
    orientation: getBlendedQuaternion(
      arithmetic,
      getStoredOrientation(arithmetic, from),
      getStoredOrientation(arithmetic, to),
      fraction
    ),
    speed: arithmetic.storeFloat(
      arithmetic.multiply(
        arithmetic.multiply(arithmetic.getSquareRoot(squaredLength), SPEED_INTERVAL_SCALE),
        SPEED_SCALE
      )
    ),
    isFinished: false,
  })
}

// FUN_00422960 while the clock is stopped: the car sits at the run's first position and orientation.
const getStartPose = (run: GhostRun): GhostPlaybackPose =>
  Object.freeze({
    position: Object.freeze({
      x: run.startPosition[0],
      y: run.startPosition[1],
      z: run.startPosition[2],
    }),
    orientation: Object.freeze({
      x: run.startQuaternion[0],
      y: run.startQuaternion[1],
      z: run.startQuaternion[2],
      w: run.startQuaternion[3],
    }),
    speed: 0,
    isFinished: false,
  })

// `piVar8[0x2e] = speed` (0x00422cdd): the speed estimate becomes the rate of the wheels (+0xb8), only while the clock
// runs (the stopped branch leaves it). The best run's copy is never animated, so the rate changes nothing visible.
const getWithWheelSpeeds = (
  session: GhostSession,
  best: GhostPlaybackPose | null,
  champion: GhostPlaybackPose | null
): GhostSession => {
  const { bestCar, championCar } = session
  const wheelClip = championCar?.wheels.clip ?? null
  const isChampionStored =
    session.isRunning && champion !== null && championCar !== null && wheelClip !== null
  const isBestStored = session.isRunning && best !== null && bestCar !== null
  if (!isChampionStored && !isBestStored) return session
  return Object.freeze({
    ...session,
    championCar: isChampionStored
      ? Object.freeze({
          ...championCar,
          wheels: Object.freeze({
            ...championCar.wheels,
            clip: Object.freeze({
              ...wheelClip,
              clip: Object.freeze({ ...wheelClip.clip, framesPerMillisecond: champion.speed }),
            }),
          }),
        })
      : championCar,
    bestCar: isBestStored
      ? Object.freeze({
          ...bestCar,
          wheels: Object.freeze({ ...bestCar.wheels, currentRate: best.speed }),
        })
      : bestCar,
  })
}

const getShownRun = (session: GhostSession, selection: GhostRunSelection): GhostRun | null => {
  if (selection === 'best') {
    return session.isBestRunShown && !session.isBestPlaybackFinished ? session.bestRun : null
  }
  return session.isChampionPlaybackFinished ? null : session.championRun
}

// FUN_00422960 (called by Race_Render's update 0x00435a00): the pose of the best run's car and the champion's car
// for the current clock, and the session with a run's playback marked finished when the clock passed its last pair.
export const stepGhostPlayback = (
  arithmetic: FloatArithmetic,
  session: GhostSession
): GhostPlaybackStep => {
  if (session.elapsedMilliseconds >= MAXIMUM_PLAYBACK_MILLISECONDS) {
    return Object.freeze({ session, best: null, champion: null })
  }
  const getPose = (selection: GhostRunSelection): GhostPlaybackPose | null => {
    const run = getShownRun(session, selection)
    if (run === null) return null
    if (!session.isRunning) return getStartPose(run)
    return getPlaybackPose(arithmetic, run, session.elapsedMilliseconds)
  }
  const best = getPose('best')
  const champion = getPose('champion')
  const isBestEnded = best === null && getShownRun(session, 'best') !== null && session.isRunning
  const isChampionEnded =
    champion === null && getShownRun(session, 'champion') !== null && session.isRunning
  const stored = getWithWheelSpeeds(session, best, champion)
  return Object.freeze({
    session:
      isBestEnded || isChampionEnded
        ? Object.freeze({
            ...stored,
            isBestPlaybackFinished: session.isBestPlaybackFinished || isBestEnded,
            isChampionPlaybackFinished: session.isChampionPlaybackFinished || isChampionEnded,
          })
        : stored,
    best,
    champion,
  })
}
