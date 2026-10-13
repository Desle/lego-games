import { getFloatFromBits } from '../../../simulation-math/index.ts'
import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import type { HazardDropperData } from '../../types/hazard-data.types.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { HazardInstance } from '../../types/hazard-runtime.types.ts'
import type { Vector3 } from '../../types/hazard.types.ts'
import { DEFAULT_HAZARD_SLOTS, getIdleHazard } from '../hazard-defaults/hazard-defaults.ts'
import { getUpdatedAfterEndRequest } from '../hazard-helpers/hazard-helpers.ts'

// 0x0048b380: the identifier 8.
export const HAZARD_DROPPER_IDENTIFIER = 8
// The power-up system's hazard kind 3 (0x0045a9b0 → 0x0045aeb0): the curse.
const HAZARD_EFFECT_KIND = 3
// 0x004b4208: the three places it drops the hazard (x, y, z each).
const DROP_PLACES: readonly Vector3[] = Object.freeze([
  Object.freeze([
    getFloatFromBits(0xc3b2ca96),
    getFloatFromBits(0x43e51041),
    getFloatFromBits(0xc13aa44c),
  ] as const),
  Object.freeze([
    getFloatFromBits(0xc3af9a00),
    getFloatFromBits(0x4401ada2),
    getFloatFromBits(0xc2bc6e6e),
  ] as const),
  Object.freeze([
    getFloatFromBits(0xc3b5210c),
    getFloatFromBits(0x43c6a6e7),
    getFloatFromBits(0xc2bdeb46),
  ] as const),
])
// 0x004b4230: the direction it faces.
const FACING: Vector3 = Object.freeze([1, 0, 0] as const)

const getIsDropperData = (data: HazardInstance['data']): data is HazardDropperData =>
  data.keyword === HazardKeyword.HAZARD_3F

// 0x0048b2f0 (constructor), 0x0048b380 (loader), 0x0048b3c0 (Begin): a signal drops the hazard at one of three
// places, picked by a draw (a mirrored track negates the place's y); the dropper stays active until it is ended.
export const HAZARD_DROPPER: HazardBehavior = Object.freeze({
  ...DEFAULT_HAZARD_SLOTS,
  create: (definition, context) =>
    Object.freeze({
      definition,
      identifier: HAZARD_DROPPER_IDENTIFIER,
      lifecycle: HazardLifecycle.IDLE,
      data: Object.freeze({
        keyword: HazardKeyword.HAZARD_3F,
        isMirrored: context.isMirrored,
      } satisfies HazardDropperData),
    }),
  begin: (instance, session) => {
    const { data } = instance
    if (!getIsDropperData(data)) return instance
    const place = DROP_PLACES[session.drawRandomValue() % DROP_PLACES.length]
    if (place === undefined) return instance
    session.emit({
      type: 'hazard.power_up_activated',
      keyword: HazardKeyword.HAZARD_3F,
      activation: 'hazard',
      effectKind: HAZARD_EFFECT_KIND,
      racerIndex: null,
      launcher: Object.freeze({
        position: Object.freeze([
          place[0],
          data.isMirrored ? -place[1] : place[1],
          place[2],
        ] as const),
        direction: FACING,
        target: null,
        speed: null,
      }),
    })
    return Object.freeze({ ...instance, lifecycle: HazardLifecycle.ACTIVE })
  },
  end: (instance) => getIdleHazard(instance),
  update: (instance) => {
    if (instance.lifecycle === HazardLifecycle.IDLE) return instance
    return getUpdatedAfterEndRequest(instance, getIdleHazard)
  },
})
