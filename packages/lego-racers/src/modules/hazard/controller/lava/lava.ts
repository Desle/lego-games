import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import type { LavaData } from '../../types/hazard-data.types.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { HazardInstance, HazardSession } from '../../types/hazard-runtime.types.ts'
import { DEFAULT_HAZARD_SLOTS } from '../hazard-defaults/hazard-defaults.ts'
import { getUpdatedAfterEndRequest } from '../hazard-helpers/hazard-helpers.ts'

// 0x0048d8e0: the identifier 0.
export const LAVA_IDENTIFIER = 0

const getIsLavaData = (data: HazardInstance['data']): data is LavaData =>
  data.keyword === HazardKeyword.HAZARD_2C

// 0x0048d9d0
const end = (instance: HazardInstance, session: HazardSession): HazardInstance => {
  const { data } = instance
  if (!getIsLavaData(data)) return instance
  if (data.isSoundHeld) {
    session.emit({ type: 'hazard.looped_sound_stopped', keyword: HazardKeyword.HAZARD_2C })
  }
  return Object.freeze({
    ...instance,
    lifecycle: HazardLifecycle.IDLE,
    data: Object.freeze({ ...data, isSoundHeld: false }),
  })
}

// 0x0048d7f0 (constructor), 0x0048d8e0 (loader), 0x0048d980 (Begin), 0x0048d9d0 (End), 0x0048da10 (update) and
// 0x0048dcd0 (touch): the lava monster of the magma track. Every racer that touches it is burnt. Its update follows
// the pose of its skeleton to decide when to spill smoke ("lavasmk") and announce signal 0x2b; the port does not
// compute that pose, so those are not ported (hypothesis for the loop sound: the sound system has a free slot).
export const LAVA: HazardBehavior = Object.freeze({
  ...DEFAULT_HAZARD_SLOTS,
  create: (definition) =>
    Object.freeze({
      definition,
      identifier: LAVA_IDENTIFIER,
      lifecycle: HazardLifecycle.IDLE,
      data: Object.freeze({
        keyword: HazardKeyword.HAZARD_2C,
        isSoundHeld: false,
      } satisfies LavaData),
    }),
  begin: (instance) => {
    const { data } = instance
    if (!getIsLavaData(data)) return instance
    return Object.freeze({
      ...instance,
      lifecycle: HazardLifecycle.ACTIVE,
      data: Object.freeze({ ...data, isSoundHeld: true }),
    })
  },
  end,
  touch: (instance, session, racer) => {
    session.emit({
      type: 'hazard.racer_affected',
      keyword: HazardKeyword.HAZARD_2C,
      racerIndex: racer.index,
      reaction: 'burnt_by_lava',
    })
    return instance
  },
  update: (instance, session) => {
    if (instance.lifecycle === HazardLifecycle.IDLE) return instance
    return getUpdatedAfterEndRequest(instance, (current) => end(current, session))
  },
})
