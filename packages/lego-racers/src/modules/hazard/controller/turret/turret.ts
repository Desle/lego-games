import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import type { TurretData } from '../../types/hazard-data.types.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { HazardInstance } from '../../types/hazard-runtime.types.ts'
import { getHazard40 } from '../hazard-definition/hazard-definition.ts'
import { DEFAULT_HAZARD_SLOTS, getIdleHazard } from '../hazard-defaults/hazard-defaults.ts'
import {
  findSkeletonReference,
  getSkeletonInstance,
  getUpdatedAfterEndRequest,
  getWithData,
} from '../hazard-helpers/hazard-helpers.ts'

// 0x0048b720: Begin sets the shot timer past the limit, so the first update fires.
const BEGUN_SHOT_MILLISECONDS = 0x206c
// 0x0048b853: a shot every 0x206c milliseconds.
const SHOT_PERIOD_MILLISECONDS = 0x206c
// 0x004b4270: the muzzle sits 17 units below the instance's position.
const MUZZLE_DROP = 17
// The power-up system's projectile kind 2 (0x0045a950 → 0x0045ac80): the grapple hook.
const PROJECTILE_EFFECT_KIND = 2
const UINT32_MODULUS = 0x1_0000_0000

const getIsTurretData = (data: HazardInstance['data']): data is TurretData =>
  data.keyword === HazardKeyword.HAZARD_40

// 0x0048b480 (constructor), 0x0048b580 (loader), 0x0048b720 (Begin), 0x0048b740 (update): a turret on a skeleton
// instance. Every 0x206c ms it hands the power-up system a projectile launched from the instance's position, 17
// units lower. Its aim (a direction turned through the cosine table over the period) is drawing state.
export const TURRET: HazardBehavior = Object.freeze({
  ...DEFAULT_HAZARD_SLOTS,
  create: (definition, context) => {
    const { vector, integer, name, secondInteger } = getHazard40(definition)
    return Object.freeze({
      definition,
      identifier: integer ?? 0,
      lifecycle: HazardLifecycle.IDLE,
      data: Object.freeze({
        keyword: HazardKeyword.HAZARD_40,
        position: vector ?? Object.freeze([0, 0, 0] as const),
        instance: name === null ? null : findSkeletonReference(context.session, 'track', name),
        periodMilliseconds: secondInteger ?? 0,
        cycleMilliseconds: 0,
        shotMilliseconds: 0,
      } satisfies TurretData),
    })
  },
  begin: (instance) => {
    const { data } = instance
    if (!getIsTurretData(data)) return instance
    return Object.freeze({
      ...instance,
      lifecycle: HazardLifecycle.ACTIVE,
      data: Object.freeze({ ...data, shotMilliseconds: BEGUN_SHOT_MILLISECONDS }),
    })
  },
  end: (instance) => getIdleHazard(instance),
  update: (instance, session, milliseconds) => {
    if (instance.lifecycle === HazardLifecycle.IDLE) return instance
    const checked = getUpdatedAfterEndRequest(instance, getIdleHazard)
    const { data } = checked
    if (!getIsTurretData(data)) return checked
    const cycle = (data.cycleMilliseconds + milliseconds) % UINT32_MODULUS
    const cycleMilliseconds = cycle >= data.periodMilliseconds >>> 0 ? 0 : cycle
    const skeleton = getSkeletonInstance(session, data.instance)
    const position =
      skeleton === null
        ? data.position
        : Object.freeze([
            skeleton.position[0],
            skeleton.position[1],
            session.arithmetic.storeFloat(
              session.arithmetic.subtract(skeleton.position[2], MUZZLE_DROP)
            ),
          ] as const)
    const shot = (data.shotMilliseconds + milliseconds) % UINT32_MODULUS
    const waiting: TurretData = { ...data, cycleMilliseconds, position, shotMilliseconds: shot }
    if (shot < SHOT_PERIOD_MILLISECONDS) return getWithData(checked, waiting)
    session.emit({
      type: 'hazard.power_up_activated',
      keyword: HazardKeyword.HAZARD_40,
      activation: 'projectile',
      effectKind: PROJECTILE_EFFECT_KIND,
      racerIndex: null,
      launcher: Object.freeze({ position, direction: null }),
    })
    return getWithData(checked, { ...waiting, shotMilliseconds: 0 })
  },
})
