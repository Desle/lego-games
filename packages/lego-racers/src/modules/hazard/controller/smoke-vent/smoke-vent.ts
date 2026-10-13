import { setEmitterBasis, setEmitterPosition } from '../../../emitter/index.ts'
import { getFloatFromBits, getFrameTransformedPoint } from '../../../simulation-math/index.ts'
import { getSkeletonInstanceBonePoint } from '../../../world-animation/index.ts'
import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import type { SmokeVentData } from '../../types/hazard-data.types.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { HazardInstance, HazardSession } from '../../types/hazard-runtime.types.ts'
import { DEFAULT_HAZARD_SLOTS } from '../hazard-defaults/hazard-defaults.ts'
import {
  findSkeletonReference,
  getActiveAfterEndRequest,
  getIdleWithEmitterReleased,
  getSkeletonInstance,
  getWithData,
  spawnTrackEmitter,
} from '../hazard-helpers/hazard-helpers.ts'

// 0x0048e710: the identifier 10.
export const SMOKE_VENT_IDENTIFIER = 10
const EMITTER_NAME = 'smoke'
const INSTANCE_NAME = 'dp_def'
const BONE_INDEX = 0
// 0x0048e8c1: the low two bits of the drawn byte pick the place (`AND EAX,0x3`).
const RANDOM_CHOICE_MASK = 0x3

// 0x004b45b0: the four places in the vent's own units (before the model scale) the smoke starts at, one chosen by the low
// two bits of a draw.
const SMOKE_PLACES: readonly (readonly [number, number, number])[] = Object.freeze([
  Object.freeze([
    // 0x004b45b0
    getFloatFromBits(0xc1c3999a),
    // 0x004b45b4
    getFloatFromBits(0x41d5eb85),
    // 0x004b45b8
    getFloatFromBits(0xc19c7ae1),
  ] as const),
  Object.freeze([
    // 0x004b45bc
    getFloatFromBits(0xc20ee148),
    // 0x004b45c0
    getFloatFromBits(0x41168f5c),
    // 0x004b45c4
    getFloatFromBits(0xc19347ae),
  ] as const),
  Object.freeze([
    // 0x004b45c8
    getFloatFromBits(0xc0dccccd),
    // 0x004b45cc
    getFloatFromBits(0xc112147b),
    // 0x004b45d0
    getFloatFromBits(0xc177d70a),
  ] as const),
  Object.freeze([
    // 0x004b45d4
    getFloatFromBits(0x408bd70a),
    // 0x004b45d8
    getFloatFromBits(0x4108a3d7),
    // 0x004b45dc
    getFloatFromBits(0xc1853333),
  ] as const),
])

const getIsSmokeVentData = (data: HazardInstance['data']): data is SmokeVentData =>
  data.keyword === HazardKeyword.HAZARD_30

// 0x0048e7c0
const end = (instance: HazardInstance, session: HazardSession): HazardInstance => {
  const { data } = instance
  if (!getIsSmokeVentData(data)) return instance
  return getWithData(getIdleWithEmitterReleased(instance, session, data.emitterHandle), {
    ...data,
    emitterHandle: null,
  })
}

// The tail of 0x0048e7f0: where the chosen place is in the world.
const placeSmoke = (
  session: HazardSession,
  data: SmokeVentData,
  handle: number,
  choice: number
): void => {
  const pool = session.getEmitters()
  const instance = getSkeletonInstance(session, data.instance)
  const place = SMOKE_PLACES[choice]
  if (pool === null || instance === null || place === undefined) return
  const { divide, multiply, storeFloat } = session.arithmetic
  const scale = instance.scale
  const inverseScale = storeFloat(divide(1, scale))
  const [first, second, third] = place
  const local = [
    storeFloat(multiply(first, inverseScale)),
    storeFloat(multiply(data.isMirrored ? -second : second, inverseScale)),
    storeFloat(multiply(third, inverseScale)),
  ] as const
  const transformed = getSkeletonInstanceBonePoint(session.arithmetic, instance, BONE_INDEX, local)
  if (transformed === null) return
  const [x, y, z] = instance.position
  const position = getFrameTransformedPoint(
    session.arithmetic,
    { rotation: instance.rotation, position: { x, y, z } },
    {
      x: storeFloat(multiply(transformed[0], scale)),
      y: storeFloat(multiply(transformed[1], scale)),
      z: storeFloat(multiply(transformed[2], scale)),
    }
  )
  session.setEmitters(
    setEmitterPosition(setEmitterBasis(pool, handle, instance.rotation), handle, position)
  )
}

// 0x0048e680 (constructor), 0x0048e710 (loader), 0x0048e7b0 (Begin), 0x0048e7c0 (End), 0x0048e7f0 (update): a vent
// that makes a "smoke" emitter while it is active and picks, with one draw per update, which of four places on the vent
// the smoke starts at: the place goes through bone 0's matrix and the instance's frame (the mirrored race flips its y),
// and the emitter takes the instance's rotation as its basis.
export const SMOKE_VENT: HazardBehavior = Object.freeze({
  ...DEFAULT_HAZARD_SLOTS,
  create: (definition, context) =>
    Object.freeze({
      definition,
      identifier: SMOKE_VENT_IDENTIFIER,
      lifecycle: HazardLifecycle.IDLE,
      data: Object.freeze({
        keyword: HazardKeyword.HAZARD_30,
        instance: findSkeletonReference(context.session, 'track', INSTANCE_NAME),
        emitterHandle: null,
        isMirrored: context.isMirrored,
      } satisfies SmokeVentData),
    }),
  begin: (instance) => Object.freeze({ ...instance, lifecycle: HazardLifecycle.ACTIVE }),
  end,
  update: (instance, session) => {
    const checked = getActiveAfterEndRequest(instance, (current) => end(current, session))
    if (checked === null) return instance
    const { data } = checked
    if (!getIsSmokeVentData(data)) return checked
    const handle = data.emitterHandle ?? spawnTrackEmitter(session, EMITTER_NAME)
    if (handle === null) return checked
    const choice = session.drawRandomValue() & RANDOM_CHOICE_MASK
    placeSmoke(session, data, handle, choice)
    return getWithData(checked, { ...data, emitterHandle: handle })
  },
})
