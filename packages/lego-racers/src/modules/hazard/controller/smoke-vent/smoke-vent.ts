import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import type { SmokeVentData } from '../../types/hazard-data.types.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { HazardInstance, HazardSession } from '../../types/hazard-runtime.types.ts'
import { DEFAULT_HAZARD_SLOTS } from '../hazard-defaults/hazard-defaults.ts'
import {
  findSkeletonReference,
  getUpdatedAfterEndRequest,
  getWithData,
  releaseTrackEmitter,
  spawnTrackEmitter,
} from '../hazard-helpers/hazard-helpers.ts'

// 0x0048e710: the identifier 10.
export const SMOKE_VENT_IDENTIFIER = 10
const EMITTER_NAME = 'smoke'
const INSTANCE_NAME = 'dp_def'

const getIsSmokeVentData = (data: HazardInstance['data']): data is SmokeVentData =>
  data.keyword === HazardKeyword.HAZARD_30

// 0x0048e7c0
const end = (instance: HazardInstance, session: HazardSession): HazardInstance => {
  const { data } = instance
  if (!getIsSmokeVentData(data)) return instance
  releaseTrackEmitter(session, data.emitterHandle)
  return Object.freeze({
    ...instance,
    lifecycle: HazardLifecycle.IDLE,
    data: Object.freeze({ ...data, emitterHandle: null }),
  })
}

// 0x0048e680 (constructor), 0x0048e710 (loader), 0x0048e7b0 (Begin), 0x0048e7c0 (End), 0x0048e7f0 (update): a vent
// that makes a "smoke" emitter while it is active and picks, with one draw per update, which of four directions the
// smoke leans. Not ported: the emitter\'s position and the lean, taken from the pose of the vent\'s skeleton.
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
    if (instance.lifecycle === HazardLifecycle.IDLE) return instance
    const checked = getUpdatedAfterEndRequest(instance, (current) => end(current, session))
    const { data } = checked
    if (!getIsSmokeVentData(data)) return checked
    const handle = data.emitterHandle ?? spawnTrackEmitter(session, EMITTER_NAME)
    if (handle === null) return checked
    session.drawRandomValue()
    return getWithData(checked, { ...data, emitterHandle: handle })
  },
})
