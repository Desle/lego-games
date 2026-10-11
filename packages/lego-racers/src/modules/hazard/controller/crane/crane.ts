import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import type { CraneData } from '../../types/hazard-data.types.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { HazardInstance, HazardSession } from '../../types/hazard-runtime.types.ts'
import { DEFAULT_HAZARD_SLOTS } from '../hazard-defaults/hazard-defaults.ts'
import {
  findSkeletonReference,
  getSkeletonInstance,
  getUpdatedAfterEndRequest,
  getWithData,
} from '../hazard-helpers/hazard-helpers.ts'

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

const getIsCraneData = (data: HazardInstance['data']): data is CraneData =>
  data.keyword === HazardKeyword.HAZARD_32

const getIsInsideAWindow = (
  time: number,
  windows: readonly (readonly [number, number])[]
): boolean => windows.some(([start, end]) => start < time && time < end)

const end = (instance: HazardInstance): HazardInstance =>
  Object.freeze({ ...instance, lifecycle: HazardLifecycle.IDLE })

// 0x0048fe30 (constructor), 0x0048ff50 (loader), 0x00490070 (Begin), 0x00490140 (End), 0x00490190 (update): the
// crane. Its clip time decides: armed and inside a signal window, it announces signal 0x14 and disarms; disarmed and
// inside an arming window it arms. Not ported: the signal\'s position (the pose of the crane\'s fourth bone), its
// shadow (class 0x00414850), the registry entry and the dust when a camera is near (0x00490330).
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
  update: (instance, session: HazardSession) => {
    if (instance.lifecycle === HazardLifecycle.IDLE) return instance
    const checked = getUpdatedAfterEndRequest(instance, end)
    const { data } = checked
    if (!getIsCraneData(data)) return checked
    const skeleton = getSkeletonInstance(session, data.instance)
    if (skeleton === null) return checked
    const time = skeleton.clip?.clip.timeInFrames ?? 0
    const isArmed = (data.flags & ARMED_FLAG) !== 0
    if (isArmed && getIsInsideAWindow(time, SIGNAL_WINDOWS)) {
      session.startStopSignal(CRANE_SIGNAL, CRANE_SIGNAL, null)
      return getWithData(checked, { ...data, flags: data.flags & ~(ARMED_FLAG | 1) })
    }
    const flags =
      !isArmed && getIsInsideAWindow(time, ARMING_WINDOWS) ? data.flags | ARMED_FLAG : data.flags
    return getWithData(checked, { ...data, flags: flags & ~1 })
  },
})
