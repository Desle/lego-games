import { getFloatFromBits } from '../../../simulation-math/index.ts'
import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import type { WarpPadData } from '../../types/hazard-data.types.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { HazardInstance } from '../../types/hazard-runtime.types.ts'
import { DEFAULT_HAZARD_SLOTS } from '../hazard-defaults/hazard-defaults.ts'
import { getUpdatedAfterEndRequest } from '../hazard-helpers/hazard-helpers.ts'

// 0x0048af10: the identifier 0 that the pad's trigger fires.
export const WARP_PAD_IDENTIFIER = 0
// Racer flag 0x10 (+0xd04): already warping.
const WARPING_FLAG = 0x10
// The power-up system's kind 3 of the activation 0x0045b260 is the warp (class 0x0045b2e0, model "warpprt").
const WARP_EFFECT_KIND = 3
// 0x004b4178..0x004b4190: where the warp lands (x, y, z) and the direction it faces (x, y, z).
const DESTINATION = Object.freeze([
  getFloatFromBits(0x4304ac4a),
  getFloatFromBits(0x42ac9ba6),
  getFloatFromBits(0x416b8d50),
] as const)
const FACING = Object.freeze([
  getFloatFromBits(0x3f800000),
  getFloatFromBits(0xbf000000),
  0,
] as const)

const getIsWarpPadData = (data: HazardInstance['data']): data is WarpPadData =>
  data.keyword === HazardKeyword.HAZARD_49

// 0x0048ae80 (constructor), 0x0048af10 (loader), 0x0048af80 (Begin), 0x0048b040 (End): a racer that touches the pad,
// unless it is already warping, is warped to the destination (a mirrored track negates the y of the destination
// and of the facing); the pad stays busy until a racer leaves it.
export const WARP_PAD: HazardBehavior = Object.freeze({
  ...DEFAULT_HAZARD_SLOTS,
  isRacerTriggered: true,
  create: (definition, context) =>
    Object.freeze({
      definition,
      identifier: WARP_PAD_IDENTIFIER,
      lifecycle: HazardLifecycle.IDLE,
      data: Object.freeze({
        keyword: HazardKeyword.HAZARD_49,
        isMirrored: context.isMirrored,
      } satisfies WarpPadData),
    }),
  begin: (instance, session, racer) => {
    const { data } = instance
    if (!getIsWarpPadData(data) || racer === null) return instance
    if (instance.lifecycle === HazardLifecycle.ACTIVE || (racer.flags & WARPING_FLAG) !== 0) {
      return instance
    }
    const sign = data.isMirrored ? -1 : 1
    session.emit({
      type: 'hazard.power_up_activated',
      keyword: HazardKeyword.HAZARD_49,
      activation: 'warp',
      effectKind: WARP_EFFECT_KIND,
      racerIndex: racer.index,
      launcher: Object.freeze({
        position: Object.freeze([DESTINATION[0], sign * DESTINATION[1], DESTINATION[2]] as const),
        direction: Object.freeze([FACING[0], sign * FACING[1], FACING[2]] as const),
      }),
    })
    return Object.freeze({ ...instance, lifecycle: HazardLifecycle.ACTIVE })
  },
  end: (instance, _session, racer) =>
    racer === null ? instance : Object.freeze({ ...instance, lifecycle: HazardLifecycle.IDLE }),
  update: (instance) => {
    if (instance.lifecycle === HazardLifecycle.IDLE) return instance
    return getUpdatedAfterEndRequest(instance, (current) => current)
  },
})
