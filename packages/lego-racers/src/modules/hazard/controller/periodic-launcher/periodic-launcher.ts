import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import type { PeriodicLauncherData } from '../../types/hazard-data.types.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { HazardInstance } from '../../types/hazard-runtime.types.ts'
import { getHazard43 } from '../hazard-definition/hazard-definition.ts'
import { DEFAULT_HAZARD_SLOTS, getIdleHazard } from '../hazard-defaults/hazard-defaults.ts'
import {
  findSkeletonReference,
  getActiveAfterEndRequest,
  getWithData,
} from '../hazard-helpers/hazard-helpers.ts'

// The power-up system's projectile kind 0 (0x0045a950 → 0x0045aa30): the cannonball.
const PROJECTILE_EFFECT_KIND = 0
const UINT32_MODULUS = 0x1_0000_0000

const getIsLauncherData = (data: HazardInstance['data']): data is PeriodicLauncherData =>
  data.keyword === HazardKeyword.HAZARD_43

// 0x0048c440 (constructor), 0x0048c530 (loader), 0x0048c670 (Begin), 0x0048c680 (update): a skeleton instance that
// throws a cannonball every `periodMilliseconds`. Begin starts the clock at the period, so the first update throws.
// Each throw draws twice, for the sideways scatter of the ball (0 to 3 units each way) before it is handed to the
// power-up system. Not ported: the throw\'s position, taken from the pose of the skeleton\'s last bone.
export const PERIODIC_LAUNCHER: HazardBehavior = Object.freeze({
  ...DEFAULT_HAZARD_SLOTS,
  create: (definition, context) => {
    const { integer, name, secondInteger, secondName } = getHazard43(definition)
    return Object.freeze({
      definition,
      identifier: integer ?? 0,
      lifecycle: HazardLifecycle.IDLE,
      data: Object.freeze({
        keyword: HazardKeyword.HAZARD_43,
        instance: name === null ? null : findSkeletonReference(context.session, 'track', name),
        periodMilliseconds: secondInteger ?? 0,
        elapsedMilliseconds: 0,
        modelName: secondName ?? '',
      } satisfies PeriodicLauncherData),
    })
  },
  begin: (instance) => {
    const { data } = instance
    if (!getIsLauncherData(data)) return instance
    return Object.freeze({
      ...instance,
      lifecycle: HazardLifecycle.ACTIVE,
      data: Object.freeze({ ...data, elapsedMilliseconds: data.periodMilliseconds }),
    })
  },
  end: (instance) => getIdleHazard(instance),
  update: (instance, session, milliseconds) => {
    const checked = getActiveAfterEndRequest(instance, getIdleHazard)
    if (checked === null) return instance
    const { data } = checked
    if (!getIsLauncherData(data)) return checked
    const elapsed = (data.elapsedMilliseconds + milliseconds) % UINT32_MODULUS
    if (elapsed < data.periodMilliseconds >>> 0) {
      return getWithData(checked, { ...data, elapsedMilliseconds: elapsed })
    }
    session.drawRandomValue()
    session.drawRandomValue()
    session.emit({
      type: 'hazard.power_up_activated',
      keyword: HazardKeyword.HAZARD_43,
      activation: 'projectile',
      effectKind: PROJECTILE_EFFECT_KIND,
      racerIndex: null,
      launcher: Object.freeze({ position: null, direction: null }),
    })
    return getWithData(checked, { ...data, elapsedMilliseconds: 0 })
  },
})
