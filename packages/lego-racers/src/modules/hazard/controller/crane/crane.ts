import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import type { CraneData } from '../../types/hazard-data.types.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { HazardInstance, HazardSession } from '../../types/hazard-runtime.types.ts'
import { DEFAULT_HAZARD_SLOTS } from '../hazard-defaults/hazard-defaults.ts'
import {
  findSkeletonReference,
  getIsInsideAWindow,
  getIsRacerSpinnable,
  getSkeletonInstance,
  getActiveAfterEndRequest,
  getSphereWhileRegistered,
  getWithData,
} from '../hazard-helpers/hazard-helpers.ts'
import { getSkeletonInstanceChainPosition } from '../../../world-animation/index.ts'

// 0x0048ff50: the identifier 1.
export const CRANE_IDENTIFIER = 1
// The signal the crane announces when its arm swings through the window (0x00490190).
export const CRANE_SIGNAL = 0x14
// Byte +0x178: bit 1 means armed; Begin sets 2.
const ARMED_FLAG = 2
// Clip times (in frames) inside which an armed crane announces its signal (0x004b4714..0x004b4720: 150..180 and
// 0..30) and inside which it arms again (0x004b4724..0x004b4730: 60..120 and 210..270).
const SIGNAL_WINDOWS: readonly (readonly [number, number])[] = Object.freeze([
  Object.freeze([150, 180] as const),
  Object.freeze([0, 30] as const),
])
const ARMING_WINDOWS: readonly (readonly [number, number])[] = Object.freeze([
  Object.freeze([60, 120] as const),
  Object.freeze([210, 270] as const),
])
const INSTANCE_NAME = 'crane'
// 0x00490190 follows the chain of the fourth bone up to the root.
const TRACKED_BONE_INDEX = 3
// 0x004b4700: the radius of the shape.
const SHAPE_RADIUS = 3
// The signal a racer that touches the crane announces (0x00490490).
const TOUCH_SIGNAL = 0x15
const ORIGIN = Object.freeze([0, 0, 0] as const)
// The instance's own scale does not enter the chain (it is 1 for the crane).
const UNSCALED = 1

const getIsCraneData = (data: HazardInstance['data']): data is CraneData =>
  data.keyword === HazardKeyword.HAZARD_32

const end = (instance: HazardInstance): HazardInstance =>
  Object.freeze({ ...instance, lifecycle: HazardLifecycle.IDLE })

// 0x0048fe30 (constructor), 0x0048ff50 (loader), 0x00490070 (Begin), 0x00490140 (End), 0x00490190 (update): the
// crane. Its sphere (radius 3) sits at the origin of the crane\'s fourth bone; a racer that touches it spins and
// announces signal 0x15 there. Its clip time decides: armed and inside a signal window, it announces signal 0x14 at
// the bone and disarms; disarmed and inside an arming window it arms. Not ported: its shadow (class 0x00414850) and
// the dust when a camera is near (0x00490330).
export const CRANE: HazardBehavior = Object.freeze({
  ...DEFAULT_HAZARD_SLOTS,
  create: (definition, context) =>
    Object.freeze({
      definition,
      identifier: CRANE_IDENTIFIER,
      lifecycle: HazardLifecycle.IDLE,
      data: Object.freeze({
        keyword: HazardKeyword.HAZARD_32,
        instance: findSkeletonReference(context.session, 'track', INSTANCE_NAME),
        flags: 0,
        sphere: Object.freeze({ centre: ORIGIN, radius: SHAPE_RADIUS }),
        posedClip: null,
        nextPosedClip: null,
      } satisfies CraneData),
    }),
  begin: (instance) => {
    const { data } = instance
    if (!getIsCraneData(data)) return instance
    return Object.freeze({
      ...instance,
      lifecycle: HazardLifecycle.ACTIVE,
      data: Object.freeze({ ...data, flags: ARMED_FLAG }),
    })
  },
  end,
  getRegisteredSphere: (instance) =>
    getIsCraneData(instance.data) ? getSphereWhileRegistered(instance, instance.data.sphere) : null,
  touch: (instance, session, racer) => {
    if (!getIsRacerSpinnable(racer)) return instance
    session.emit({
      type: 'hazard.racer_affected',
      keyword: HazardKeyword.HAZARD_32,
      racerIndex: racer.index,
      reaction: 'spun',
      vector: null,
    })
    session.startStopSignal(TOUCH_SIGNAL, TOUCH_SIGNAL, racer.position)
    return instance
  },
  update: (instance, session: HazardSession) => {
    const ended = getActiveAfterEndRequest(instance, end)
    if (ended === null) {
      // The draw poses the bones whether or not the hazard is active, so the clip of this frame is remembered.
      return getIsCraneData(instance.data)
        ? getWithData(instance, {
            ...instance.data,
            nextPosedClip: getSkeletonInstance(session, instance.data.instance)?.clip ?? null,
          })
        : instance
    }
    const { data: endedData } = ended
    if (!getIsCraneData(endedData)) return ended
    const skeleton = getSkeletonInstance(session, endedData.instance)
    if (skeleton === null) return ended
    const posedClip = endedData.nextPosedClip ?? skeleton.clip
    const position =
      getSkeletonInstanceChainPosition(
        session.arithmetic,
        Object.freeze({ ...skeleton, clip: posedClip }),
        TRACKED_BONE_INDEX,
        UNSCALED
      ) ?? endedData.sphere.centre
    const checked = getWithData(ended, {
      ...endedData,
      posedClip,
      nextPosedClip: skeleton.clip,
      sphere: Object.freeze({ centre: position, radius: endedData.sphere.radius }),
    })
    const { data } = checked
    if (!getIsCraneData(data)) return checked
    const time = skeleton.clip?.clip.timeInFrames ?? 0
    const isArmed = (data.flags & ARMED_FLAG) !== 0
    if (isArmed && getIsInsideAWindow(time, SIGNAL_WINDOWS)) {
      session.startStopSignal(CRANE_SIGNAL, CRANE_SIGNAL, position)
      return getWithData(checked, { ...data, flags: data.flags & ~(ARMED_FLAG | 1) })
    }
    const flags =
      !isArmed && getIsInsideAWindow(time, ARMING_WINDOWS) ? data.flags | ARMED_FLAG : data.flags
    return getWithData(checked, { ...data, flags: flags & ~1 })
  },
})
