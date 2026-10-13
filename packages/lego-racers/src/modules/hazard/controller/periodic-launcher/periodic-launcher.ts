import {
  getSkeletonInstanceBoneAxes,
  getSkeletonInstanceBoneTranslation,
} from '../../../world-animation/index.ts'
import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import type { PeriodicLauncherData } from '../../types/hazard-data.types.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type {
  HazardInstance,
  HazardLauncher,
  HazardSession,
} from '../../types/hazard-runtime.types.ts'
import type { Vector3 } from '../../types/hazard.types.ts'
import { getHazard43 } from '../hazard-definition/hazard-definition.ts'
import { DEFAULT_HAZARD_SLOTS, getIdleHazard } from '../hazard-defaults/hazard-defaults.ts'
import {
  findSkeletonReference,
  getActiveAfterEndRequest,
  getSkeletonInstance,
  getWithData,
} from '../hazard-helpers/hazard-helpers.ts'

// The power-up system's projectile kind 0 (0x0045a950 → 0x0045aa30): the cannonball.
const PROJECTILE_EFFECT_KIND = 0
const UINT32_MODULUS = 0x1_0000_0000
// 0x0048c6c6: the throw leaves from the skeleton's second bone (skeleton slot +0x18 with 1).
const THROWING_BONE_INDEX = 1
// 0x004b43a0: the ball starts this far back along the bone's third row, turned by the instance.
const MUZZLE_SETBACK = 35
// 0x0048c782: the low two bits of a draw, less 2 (0x004b009c), scatter the target sideways.
const SCATTER_MASK = 3
const SCATTER_CENTRE = 2
// 0x004af388: the target is one unit above the start.
const TARGET_HEIGHT = 1
// 0x0048c73d: +0x30, the ball's speed.
const CANNONBALL_SPEED = 30

const getIsLauncherData = (data: HazardInstance['data']): data is PeriodicLauncherData =>
  data.keyword === HazardKeyword.HAZARD_43

// 0x0048c440 (constructor), 0x0048c530 (loader), 0x0048c670 (Begin), 0x0048c680 (update): a skeleton instance that
// throws a cannonball every `periodMilliseconds`. Begin starts the clock at the period, so the first update throws.
// Each throw poses the instance (vtable +0x5c, so the clip of this frame), starts the ball at its second bone moved
// back along the bone's third row, and draws twice for the sideways scatter of the target before it is handed to the
// power-up system as the launcher (system +0x1998).
// 0x0048c6b0..0x0048c821: the start (+0x24..+0x2c) is the bone's translation, scaled and carried by the instance,
// less 35 times the bone's third row turned by the instance; the target (+0x18..+0x20) is the start scattered by two
// draws (moved 2 more in x when both draws give 2, so it never sits right above the start) and raised by 1.
const getThrow = (session: HazardSession, data: PeriodicLauncherData): HazardLauncher => {
  const { add, subtract, multiply, storeFloat } = session.arithmetic
  const skeleton = getSkeletonInstance(session, data.instance)
  const bone =
    skeleton === null
      ? null
      : getSkeletonInstanceBoneTranslation(session.arithmetic, skeleton, THROWING_BONE_INDEX)
  const axes =
    skeleton === null
      ? null
      : getSkeletonInstanceBoneAxes(session.arithmetic, skeleton, THROWING_BONE_INDEX)
  const origin = bone ?? [0, 0, 0]
  const row = axes?.third ?? { x: 0, y: 0, z: 0 }
  const start: Vector3 = Object.freeze([
    storeFloat(subtract(origin[0], multiply(row.x, MUZZLE_SETBACK))),
    storeFloat(subtract(origin[1], multiply(row.y, MUZZLE_SETBACK))),
    storeFloat(subtract(origin[2], multiply(row.z, MUZZLE_SETBACK))),
  ] as const)
  const firstScatter = session.drawRandomValue() & SCATTER_MASK
  const secondScatter = session.drawRandomValue() & SCATTER_MASK
  const targetX = storeFloat(subtract(add(firstScatter, start[0]), SCATTER_CENTRE))
  const targetY = subtract(add(secondScatter, start[1]), SCATTER_CENTRE)
  const isAboveStart = targetX === start[0] && targetY === start[1]
  return Object.freeze({
    position: start,
    direction: null,
    target: Object.freeze([
      isAboveStart ? storeFloat(add(targetX, SCATTER_CENTRE)) : targetX,
      storeFloat(targetY),
      storeFloat(add(start[2], TARGET_HEIGHT)),
    ] as const),
    speed: CANNONBALL_SPEED,
  })
}

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
    session.emit({
      type: 'hazard.power_up_activated',
      keyword: HazardKeyword.HAZARD_43,
      activation: 'projectile',
      effectKind: PROJECTILE_EFFECT_KIND,
      racerIndex: null,
      launcher: getThrow(session, data),
    })
    return getWithData(checked, { ...data, elapsedMilliseconds: 0 })
  },
})
