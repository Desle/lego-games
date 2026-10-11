import type { HammerWatcherData } from '../../types/hazard-data.types.ts'
import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { HazardInstance } from '../../types/hazard-runtime.types.ts'
import { DEFAULT_HAZARD_SLOTS, getIdleHazard } from '../hazard-defaults/hazard-defaults.ts'
import {
  findSkeletonReference,
  getSkeletonInstance,
  getUpdatedAfterEndRequest,
  getWithData,
} from '../hazard-helpers/hazard-helpers.ts'

// 0x0048d080: the identifier the hammer's events announce to start the watcher.
export const HAMMER_WATCHER_IDENTIFIER = 0x32
// The signal the watcher announces when the hammer strikes (0x0048d150).
export const HAMMER_STRIKE_SIGNAL = 0x2b
// 0x0048d130: Begin arms the flags.
const BEGUN_FLAGS = 7
const ARMED_FLAG = 1
// Clip times (in frames) between which the hammer strikes (0x004b4414..0x004b4420) and between which it is armed
// again (0x004b4424..0x004b4430).
const STRIKE_WINDOWS: readonly (readonly [number, number])[] = Object.freeze([
  Object.freeze([22, 28] as const),
  Object.freeze([72, 78] as const),
])
const ARMING_WINDOWS: readonly (readonly [number, number])[] = Object.freeze([
  Object.freeze([0, 20] as const),
  Object.freeze([40, 60] as const),
])
const HAMMER_NAME = 'rkhamm02'

const getIsHammerData = (data: HazardInstance['data']): data is HammerWatcherData =>
  data.keyword === HazardKeyword.HAZARD_2A

const getIsInsideAWindow = (
  time: number,
  windows: readonly (readonly [number, number])[]
): boolean => windows.some(([start, end]) => start < time && time < end)

const end = (instance: HazardInstance): HazardInstance => getIdleHazard(instance)

// 0x0048d150: the hammer's clip time (instance +0xb4) decides: when armed and inside a strike window the events
// hear signal 0x2b once and the watcher disarms; when disarmed and inside an arming window it arms again.
export const HAMMER_WATCHER: HazardBehavior = Object.freeze({
  ...DEFAULT_HAZARD_SLOTS,
  create: (definition, context) =>
    Object.freeze({
      definition,
      identifier: HAMMER_WATCHER_IDENTIFIER,
      lifecycle: HazardLifecycle.IDLE,
      data: Object.freeze({
        keyword: HazardKeyword.HAZARD_2A,
        hammer: findSkeletonReference(context.session, 'track', HAMMER_NAME),
        flags: 0,
      } satisfies HammerWatcherData),
    }),
  begin: (instance) => {
    const { data } = instance
    if (!getIsHammerData(data)) return instance
    return Object.freeze({
      ...instance,
      lifecycle: HazardLifecycle.ACTIVE,
      data: Object.freeze({ ...data, flags: BEGUN_FLAGS }),
    })
  },
  end: (instance) => end(instance),
  update: (instance, session) => {
    if (instance.lifecycle === HazardLifecycle.IDLE) return instance
    const checked = getUpdatedAfterEndRequest(instance, end)
    const { data } = checked
    if (!getIsHammerData(data)) return checked
    const hammer = getSkeletonInstance(session, data.hammer)
    if (hammer === null) return checked
    const time = hammer.clip?.clip.timeInFrames ?? 0
    const isArmed = (data.flags & ARMED_FLAG) !== 0
    if (isArmed && getIsInsideAWindow(time, STRIKE_WINDOWS)) {
      session.startStopSignal(HAMMER_STRIKE_SIGNAL, HAMMER_STRIKE_SIGNAL, null)
      return getWithData(checked, { ...data, flags: data.flags & ~ARMED_FLAG })
    }
    if (!isArmed && getIsInsideAWindow(time, ARMING_WINDOWS)) {
      return getWithData(checked, { ...data, flags: data.flags | ARMED_FLAG })
    }
    return checked
  },
})
