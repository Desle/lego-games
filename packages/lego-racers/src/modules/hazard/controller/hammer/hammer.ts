import { getSkeletonInstanceWithTime } from '../../../world-animation/index.ts'
import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import type { HammerData } from '../../types/hazard-data.types.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { HazardInstance } from '../../types/hazard-runtime.types.ts'
import { getHazard3E } from '../hazard-definition/hazard-definition.ts'
import { DEFAULT_HAZARD_SLOTS, getIdleHazard } from '../hazard-defaults/hazard-defaults.ts'
import {
  findSkeletonReference,
  getSkeletonInstance,
  getUpdatedAfterEndRequest,
  setSkeletonInstance,
} from '../hazard-helpers/hazard-helpers.ts'

const getIsHammerData = (data: HazardInstance['data']): data is HammerData =>
  data.keyword === HazardKeyword.HAZARD_3E

// 0x0048bb00 (constructor), 0x0048bbf0 (loader), 0x0048be00 (Begin), 0x0048be50 (End), 0x0048be70 (update): the
// swinging hammer of Royal Knights Raceway. The loader finds the skeleton instance by name and sets its clip time to
// the file's float (0 there); while active the hammer sits in the collision registry (a box of the file's size) and
// follows the pose of the skeleton\'s last bone. Not ported: the registry entry and the box\'s pose.
export const HAMMER: HazardBehavior = Object.freeze({
  ...DEFAULT_HAZARD_SLOTS,
  create: (definition, context) => {
    const { name, integer, float } = getHazard3E(definition)
    const reference = findSkeletonReference(context.session, 'track', name)
    const skeleton = getSkeletonInstance(context.session, reference)
    if (skeleton !== null) {
      setSkeletonInstance(context.session, reference, getSkeletonInstanceWithTime(skeleton, float))
    }
    return Object.freeze({
      definition,
      identifier: integer,
      lifecycle: HazardLifecycle.IDLE,
      data: Object.freeze({
        keyword: HazardKeyword.HAZARD_3E,
        instance: reference,
      } satisfies HammerData),
    })
  },
  begin: (instance) => Object.freeze({ ...instance, lifecycle: HazardLifecycle.ACTIVE }),
  end: (instance) => getIdleHazard(instance),
  update: (instance) => {
    if (instance.lifecycle === HazardLifecycle.IDLE) return instance
    const checked = getUpdatedAfterEndRequest(instance, getIdleHazard)
    return getIsHammerData(checked.data) ? checked : instance
  },
})
