import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import type { ScrollerData } from '../../types/hazard-data.types.ts'
import { getHazard36 } from '../hazard-definition/hazard-definition.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { HazardInstance, HazardSession } from '../../types/hazard-runtime.types.ts'
import { DEFAULT_HAZARD_SLOTS, getIdleHazard } from '../hazard-defaults/hazard-defaults.ts'
import {
  findMeshReference,
  findSkeletonReference,
  getUpdatedAfterEndRequest,
  getWithData,
  NO_IDENTIFIER,
} from '../hazard-helpers/hazard-helpers.ts'

// 0x004b41f8: the scroll repeats every 10,000 milliseconds.
const CYCLE_MILLISECONDS = 10_000

const getIsScrollerData = (data: HazardInstance['data']): data is ScrollerData =>
  data.keyword === HazardKeyword.HAZARD_36

// 0x0048b110: the name is looked up in the first world's mesh instances, then its skeleton instances, then the
// second world's.
const findScrolledInstance = (session: HazardSession, name: string) =>
  findMeshReference(session, 'track', name) ??
  findSkeletonReference(session, 'track', name) ??
  findMeshReference(session, 'blended', name) ??
  findSkeletonReference(session, 'blended', name)

// 0x0048b080 (constructor), 0x0048b110 (loader), 0x0048b220 (Begin), 0x0048b240 (update): a texture scrolls with
// the time of a 10,000 ms cycle. The scroll offset is drawing state (`0x00411700`, `0x00411730` set the instance's
// scroll rates from a sine table); only the cycle is kept.
export const SCROLLER: HazardBehavior = Object.freeze({
  ...DEFAULT_HAZARD_SLOTS,
  create: (definition, context) => {
    const { name, firstFloat, secondFloat } = getHazard36(definition)
    return Object.freeze({
      definition,
      identifier: NO_IDENTIFIER,
      lifecycle: HazardLifecycle.IDLE,
      data: Object.freeze({
        keyword: HazardKeyword.HAZARD_36,
        instance: findScrolledInstance(context.session, name),
        firstFloat,
        secondFloat,
        cycleMilliseconds: 0,
      } satisfies ScrollerData),
    })
  },
  begin: (instance) => {
    const { data } = instance
    if (!getIsScrollerData(data)) return instance
    return Object.freeze({
      ...instance,
      lifecycle: HazardLifecycle.ACTIVE,
      data: Object.freeze({ ...data, cycleMilliseconds: 0 }),
    })
  },
  end: (instance) => getIdleHazard(instance),
  update: (instance, session, milliseconds) => {
    const checked = getUpdatedAfterEndRequest(instance, getIdleHazard)
    const { data } = checked
    if (!getIsScrollerData(data)) return checked
    const { arithmetic } = session
    const time = arithmetic.storeFloat(arithmetic.add(milliseconds, data.cycleMilliseconds))
    const cycleMilliseconds =
      time < CYCLE_MILLISECONDS
        ? time
        : arithmetic.storeFloat(arithmetic.subtract(time, CYCLE_MILLISECONDS))
    return getWithData(checked, { ...data, cycleMilliseconds })
  },
})
