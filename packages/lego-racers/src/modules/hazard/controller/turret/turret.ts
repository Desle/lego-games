import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import type { TurretData } from '../../types/hazard-data.types.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { HazardInstance, HazardSession } from '../../types/hazard-runtime.types.ts'
import {
  getFloatFromBits,
  getNormalizedVector3,
  getTruncatedInteger,
} from '../../../simulation-math/index.ts'
import type { Vector3 } from '../../types/hazard.types.ts'
import { getHazard40 } from '../hazard-definition/hazard-definition.ts'
import { DEFAULT_HAZARD_SLOTS, getIdleHazard } from '../hazard-defaults/hazard-defaults.ts'
import {
  findSkeletonReference,
  getSkeletonInstance,
  getActiveAfterEndRequest,
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
const ORIGIN = Object.freeze([0, 0, 0] as const)
// 0x004b03f0, 0x004b0b48, 0x004b02f4, 0x004b02f8: pi, and the angle-to-table-index scales (1024 / 2 pi, negated) and 2 pi.
const PI = getFloatFromBits(0x40490fdb)
const TABLE_INDEX_PER_RADIAN = getFloatFromBits(0x4322f983) // float32 at 0x004b0b48
const TABLE_INDEX_PER_RADIAN_BACKWARDS = getFloatFromBits(0xc322f983) // float32 at 0x004b02f4
const TWO_PI = getFloatFromBits(0x40c90fdb) // float32 at 0x004b02f8
const TABLE_MASK = 0x3ff // AND EAX,0x3ff at 0x0048b7ab
const TABLE_QUARTER_TURN = 0x100 // MOV ECX,0xffffff00 at 0x0048b7c4

// 0x0048b777..0x0048b824: the direction the muzzle points, from the position in the period: x from the first half-turn,
// y from the same angle a quarter turn on (negated when mirrored), z from the quarter periods, then normalised.
const getAimDirection = (session: HazardSession, data: TurretData, cycle: number): Vector3 => {
  const { divide, multiply, subtract, add, storeFloat } = session.arithmetic
  const half = data.periodMilliseconds >>> 1
  const quarter = data.periodMilliseconds >>> 2
  const unfolded = multiply(divide(cycle, half), data.aim[0])
  const angle = cycle > half ? subtract(PI, unfolded) : unfolded
  const x = session.getTableCosine(
    getTruncatedInteger(multiply(angle, TABLE_INDEX_PER_RADIAN)) & TABLE_MASK
  )
  const backwards = getTruncatedInteger(multiply(angle, TABLE_INDEX_PER_RADIAN_BACKWARDS))
  const cosine = session.getTableCosine((-TABLE_QUARTER_TURN - backwards) & TABLE_MASK)
  const y = data.isMirrored ? -cosine : cosine
  const lift = session.getTableCosine(
    getTruncatedInteger(
      multiply(multiply(divide(cycle, quarter), TWO_PI), TABLE_INDEX_PER_RADIAN)
    ) & TABLE_MASK
  )
  const z = storeFloat(add(multiply(lift, data.aim[1]), data.aim[2]))
  const direction = getNormalizedVector3(session.arithmetic, { x, y, z })
  return Object.freeze([direction.x, direction.y, direction.z] as const)
}

const getIsTurretData = (data: HazardInstance['data']): data is TurretData =>
  data.keyword === HazardKeyword.HAZARD_40

// 0x0048b480 (constructor), 0x0048b580 (loader), 0x0048b720 (Begin), 0x0048b740 (update): a turret on a skeleton
// instance. Every 0x206c ms it hands the power-up system a projectile launched from the instance's position, 17
// units lower. Its aim (a direction turned through the cosine table over the period) is drawing state.
export const TURRET: HazardBehavior = Object.freeze({
  ...DEFAULT_HAZARD_SLOTS,
  create: (definition, context) => {
    const { vector, integer, name, secondInteger, secondVector } = getHazard40(definition)
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
        aim: secondVector ?? ORIGIN,
        isMirrored: context.isMirrored,
        direction: ORIGIN,
      } satisfies TurretData),
    })
  },
  begin: (instance) => {
    const { data } = instance
    if (!getIsTurretData(data)) return instance
    return getWithData(Object.freeze({ ...instance, lifecycle: HazardLifecycle.ACTIVE }), {
      ...data,
      shotMilliseconds: BEGUN_SHOT_MILLISECONDS,
    })
  },
  end: (instance) => getIdleHazard(instance),
  update: (instance, session, milliseconds) => {
    const checked = getActiveAfterEndRequest(instance, getIdleHazard)
    if (checked === null) return instance
    if (!getIsTurretData(checked.data)) return checked
    const { data } = checked
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
    const direction = getAimDirection(session, data, cycleMilliseconds)
    const waiting: TurretData = {
      ...data,
      cycleMilliseconds,
      position,
      direction,
      shotMilliseconds: shot,
    }
    if (shot < SHOT_PERIOD_MILLISECONDS) return getWithData(checked, waiting)
    session.emit({
      type: 'hazard.power_up_activated',
      keyword: HazardKeyword.HAZARD_40,
      activation: 'projectile',
      effectKind: PROJECTILE_EFFECT_KIND,
      racerIndex: null,
      launcher: Object.freeze({
        position,
        direction,
        target: null,
        speed: null,
      }),
    })
    return getWithData(checked, { ...waiting, shotMilliseconds: 0 })
  },
})
