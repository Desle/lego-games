import { getSkeletonInstanceFlags, INSTANCE_BLENDING_FLAG } from '../../../world-animation/index.ts'
import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import type { CaptureData } from '../../types/hazard-data.types.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { Vector3 } from '../../types/hazard.types.ts'
import type { HazardInstance, HazardSession } from '../../types/hazard-runtime.types.ts'
import { getHazard48 } from '../hazard-definition/hazard-definition.ts'
import { DEFAULT_HAZARD_SLOTS } from '../hazard-defaults/hazard-defaults.ts'
import {
  findSkeletonReference,
  getSkeletonInstance,
  getActiveAfterEndRequest,
  getSphereOnBone,
  getSphereWhileRegistered,
  getWithData,
} from '../hazard-helpers/hazard-helpers.ts'
import { getNormalizedVector3 } from '../../../simulation-math/index.ts'

// Racer flag 0x1 (+0xd04): shielded; the hazard sets 0x20000000 on the racer it holds.
const SHIELDED_FLAG = 1
// +0x58 of the hazard.
const PHASE_IDLE = 0
const PHASE_HOLDING = 1
const PHASE_RESTING = 2
// 0x0048e050 and 0x0048dfa0: how long it holds a racer, and how long the touch phase lasts, in milliseconds.
const HOLD_MILLISECONDS = 500
const PHASE_MILLISECONDS = 1000
const FIRST_BONE_INDEX = 0
// 0x004b4514: the radius of the shape.
const SHAPE_RADIUS = 45
const ORIGIN = Object.freeze([0, 0, 0] as const)

const getIsCaptureData = (data: HazardInstance['data']): data is CaptureData =>
  data.keyword === HazardKeyword.HAZARD_48

// 0x0048e230: the racer it holds is let go.
const getReleased = (session: HazardSession, data: CaptureData): CaptureData => {
  if (data.capturedRacer === null) return data
  session.emit({
    type: 'hazard.racer_affected',
    keyword: HazardKeyword.HAZARD_48,
    racerIndex: data.capturedRacer,
    reaction: 'released',
    vector: null,
  })
  return { ...data, capturedRacer: null }
}

// 0x0048e050 without a vehicle object: the unit direction from the racer to the hazard in the horizontal plane, times
// the strength of the file.
const getPull = (
  arithmetic: HazardSession['arithmetic'],
  strength: number,
  hazardPosition: Vector3,
  racerPosition: Vector3
): Vector3 => {
  const { multiply, storeFloat, subtract } = arithmetic
  const direction = getNormalizedVector3(arithmetic, {
    x: storeFloat(subtract(hazardPosition[0], racerPosition[0])),
    y: storeFloat(subtract(hazardPosition[1], racerPosition[1])),
    z: 0,
  })
  return [
    storeFloat(multiply(strength, direction.x)),
    storeFloat(multiply(strength, direction.y)),
    storeFloat(multiply(strength, direction.z)),
  ]
}

// 0x0048df70
const end = (instance: HazardInstance, session: HazardSession): HazardInstance => {
  const { data } = instance
  if (!getIsCaptureData(data)) return instance
  return Object.freeze({
    ...instance,
    lifecycle: HazardLifecycle.IDLE,
    data: Object.freeze({
      ...getReleased(session, data),
      phase: PHASE_IDLE,
      phaseMilliseconds: 0,
    }),
  })
}

// 0x0048dd20 (constructor), 0x0048de10 (loader), 0x0048df20 (Begin), 0x0048df70 (End), 0x0048dfa0 (update) and
// 0x0048e050 (touch): a hazard that holds the first unshielded racer that touches it, unless the clip of its
// skeleton is between the two times of the file. It lets go after 500 ms, rests for a second, and may hold again.
// Begin registers its sphere (radius 45, centred on the first bone of the instance every update); the collision
// registry delivers the touch, and a hold pulls the racer towards the hazard (no vehicle object, as the rest of the port).
export const CAPTURE: HazardBehavior = Object.freeze({
  ...DEFAULT_HAZARD_SLOTS,
  create: (definition, context) => {
    const { integer, name, vector } = getHazard48(definition)
    return Object.freeze({
      definition,
      identifier: integer ?? 0,
      lifecycle: HazardLifecycle.IDLE,
      data: Object.freeze({
        keyword: HazardKeyword.HAZARD_48,
        instance: name === null ? null : findSkeletonReference(context.session, 'track', name),
        releaseWindow: Object.freeze([vector?.[1] ?? 0, vector?.[2] ?? 0] as const),
        pullStrength: vector?.[0] ?? 0,
        sphere: Object.freeze({ centre: ORIGIN, radius: SHAPE_RADIUS }),
        capturedRacer: null,
        holdMilliseconds: 0,
        phase: PHASE_IDLE,
        phaseMilliseconds: 0,
        posedClip: null,
        nextPosedClip: null,
      } satisfies CaptureData),
    })
  },
  begin: (instance) => {
    const { data } = instance
    if (!getIsCaptureData(data)) return instance
    return Object.freeze({
      ...instance,
      lifecycle: HazardLifecycle.ACTIVE,
      data: Object.freeze({ ...data, phase: PHASE_IDLE, phaseMilliseconds: 0 }),
    })
  },
  end,
  getRegisteredSphere: (instance) =>
    getIsCaptureData(instance.data)
      ? getSphereWhileRegistered(instance, instance.data.sphere)
      : null,
  touch: (instance, session, racer) => {
    const { data } = instance
    if (!getIsCaptureData(data) || data.phase === PHASE_RESTING) return instance
    const skeleton = getSkeletonInstance(session, data.instance)
    const time =
      skeleton === null
        ? 0
        : (getSkeletonInstanceFlags(skeleton) & INSTANCE_BLENDING_FLAG) === 0
          ? (skeleton.clip?.clip.timeInFrames ?? 0)
          : (skeleton.clip?.secondClip.timeInFrames ?? 0)
    const [windowStart, windowEnd] = data.releaseWindow
    if (windowStart < time && time < windowEnd) return instance
    if ((racer.flags & SHIELDED_FLAG) !== 0) return instance
    if (data.capturedRacer !== null && data.capturedRacer !== racer.index) return instance
    // 0x0048e1c0 reads the bone again; the pull is horizontal, from the racer to the hazard.
    const { centre } = getSphereOnBone(
      session,
      data.instance,
      FIRST_BONE_INDEX,
      data.sphere,
      data.posedClip
    )
    session.emit({
      type: 'hazard.racer_affected',
      keyword: HazardKeyword.HAZARD_48,
      racerIndex: racer.index,
      reaction: 'captured',
      vector: getPull(session.arithmetic, data.pullStrength, centre, racer.position),
    })
    const isFirstHold = data.capturedRacer === null
    return getWithData(instance, {
      ...data,
      sphere: Object.freeze({ centre, radius: data.sphere.radius }),
      capturedRacer: racer.index,
      holdMilliseconds: HOLD_MILLISECONDS,
      phase: isFirstHold ? PHASE_HOLDING : data.phase,
      phaseMilliseconds: isFirstHold ? PHASE_MILLISECONDS : data.phaseMilliseconds,
    })
  },
  update: (instance, session, milliseconds) => {
    const ended = getActiveAfterEndRequest(instance, (current) => end(current, session))
    if (ended === null) {
      // The draw poses the bones whether or not the hazard is active, so the clip of this frame is remembered.
      return getIsCaptureData(instance.data)
        ? getWithData(instance, {
            ...instance.data,
            nextPosedClip: getSkeletonInstance(session, instance.data.instance)?.clip ?? null,
          })
        : instance
    }
    const { data: endedData } = ended
    if (!getIsCaptureData(endedData)) return ended
    const latestClip = getSkeletonInstance(session, endedData.instance)?.clip ?? null
    const posedClip = endedData.nextPosedClip ?? latestClip
    const checked = getWithData(ended, {
      ...endedData,
      posedClip,
      nextPosedClip: latestClip,
      sphere: getSphereOnBone(
        session,
        endedData.instance,
        FIRST_BONE_INDEX,
        endedData.sphere,
        posedClip
      ),
    })
    const { data } = checked
    if (!getIsCaptureData(data)) return checked
    let next: CaptureData = data
    if (next.holdMilliseconds !== 0) {
      next =
        milliseconds < next.holdMilliseconds
          ? { ...next, holdMilliseconds: next.holdMilliseconds - milliseconds }
          : {
              ...getReleased(session, next),
              holdMilliseconds: 0,
              phase: PHASE_IDLE,
              phaseMilliseconds: 0,
            }
    }
    if (next.phaseMilliseconds !== 0) {
      if (milliseconds < next.phaseMilliseconds) {
        next = { ...next, phaseMilliseconds: next.phaseMilliseconds - milliseconds }
      } else if (next.phase === PHASE_HOLDING) {
        next = {
          ...getReleased(session, next),
          holdMilliseconds: 0,
          phase: PHASE_RESTING,
          phaseMilliseconds: PHASE_MILLISECONDS,
        }
      } else {
        next = {
          ...next,
          phaseMilliseconds: 0,
          phase: next.phase === PHASE_RESTING ? PHASE_IDLE : next.phase,
        }
      }
    }
    return getWithData(checked, next)
  },
})
