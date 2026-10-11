import { getSkeletonInstanceFlags, INSTANCE_BLENDING_FLAG } from '../../../world-animation/index.ts'
import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import type { CaptureData } from '../../types/hazard-data.types.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { HazardInstance, HazardSession } from '../../types/hazard-runtime.types.ts'
import { getHazard48 } from '../hazard-definition/hazard-definition.ts'
import { DEFAULT_HAZARD_SLOTS } from '../hazard-defaults/hazard-defaults.ts'
import {
  findSkeletonReference,
  getSkeletonInstance,
  getActiveAfterEndRequest,
  getWithData,
} from '../hazard-helpers/hazard-helpers.ts'

// Racer flag 0x1 (+0xd04): shielded; the hazard sets 0x20000000 on the racer it holds.
const SHIELDED_FLAG = 1
// +0x58 of the hazard.
const PHASE_IDLE = 0
const PHASE_HOLDING = 1
const PHASE_RESTING = 2
// 0x0048e050 and 0x0048dfa0: how long it holds a racer, and how long the touch phase lasts, in milliseconds.
const HOLD_MILLISECONDS = 500
const PHASE_MILLISECONDS = 1000

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
  })
  return { ...data, capturedRacer: null }
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
// The touch is reported by the caller (the registry\'s overlap test is not ported).
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
        capturedRacer: null,
        holdMilliseconds: 0,
        phase: PHASE_IDLE,
        phaseMilliseconds: 0,
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
    session.emit({
      type: 'hazard.racer_affected',
      keyword: HazardKeyword.HAZARD_48,
      racerIndex: racer.index,
      reaction: 'captured',
    })
    const isFirstHold = data.capturedRacer === null
    return getWithData(instance, {
      ...data,
      capturedRacer: racer.index,
      holdMilliseconds: HOLD_MILLISECONDS,
      phase: isFirstHold ? PHASE_HOLDING : data.phase,
      phaseMilliseconds: isFirstHold ? PHASE_MILLISECONDS : data.phaseMilliseconds,
    })
  },
  update: (instance, session, milliseconds) => {
    const checked = getActiveAfterEndRequest(instance, (current) => end(current, session))
    if (checked === null) return instance
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
