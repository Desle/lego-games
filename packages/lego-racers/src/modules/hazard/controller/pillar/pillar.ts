import {
  getSkeletonInstanceTime,
  getSkeletonInstanceWithFlagsChanged,
  INSTANCE_ANIMATED_FLAG,
  INSTANCE_LOOPING_FLAG,
  startSkeletonInstanceClip,
} from '../../../world-animation/index.ts'
import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import type { PillarData } from '../../types/hazard-data.types.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { HazardInstance } from '../../types/hazard-runtime.types.ts'
import { DEFAULT_HAZARD_SLOTS } from '../hazard-defaults/hazard-defaults.ts'
import {
  findSkeletonReference,
  getSkeletonInstance,
  getActiveAfterEndRequest,
  getWithData,
  setSkeletonInstance,
} from '../hazard-helpers/hazard-helpers.ts'

// 0x0048b920: the identifier the pillar's events announce.
export const PILLAR_IDENTIFIER = 10
// The signal the pillar announces when it lands (0x0048ba20).
export const PILLAR_LANDED_SIGNAL = 7
// The clip time (0x004b42b4) after which the pillar's collision object is solid.
const LANDING_TIME = 50
const PILLAR_NAME = 'piltop'
const COLLISION_OBJECT_NAME = 'pilcol'

const getIsPillarData = (data: HazardInstance['data']): data is PillarData =>
  data.keyword === HazardKeyword.HAZARD_28

// 0x0048b920 (loader), 0x0048b9e0 (Begin), 0x0048ba20 (update): the pillar starts its fall clip, once, without
// looping; after frame 50 its collision object turns solid and the events hear signal 7. It has no End (the slot is a
// no-op).
export const PILLAR: HazardBehavior = Object.freeze({
  ...DEFAULT_HAZARD_SLOTS,
  create: (definition, context) => {
    const pillar = findSkeletonReference(context.session, 'track', PILLAR_NAME)
    const skeleton = getSkeletonInstance(context.session, pillar)
    if (skeleton !== null) {
      setSkeletonInstance(
        context.session,
        pillar,
        getSkeletonInstanceWithFlagsChanged(skeleton, 0, INSTANCE_ANIMATED_FLAG)
      )
    }
    return Object.freeze({
      definition,
      identifier: PILLAR_IDENTIFIER,
      lifecycle: HazardLifecycle.IDLE,
      data: Object.freeze({
        keyword: HazardKeyword.HAZARD_28,
        pillar,
        collisionObjectName: COLLISION_OBJECT_NAME,
        isSolid: false,
      } satisfies PillarData),
    })
  },
  begin: (instance, session) => {
    const { data } = instance
    if (!getIsPillarData(data)) return instance
    const skeleton = getSkeletonInstance(session, data.pillar)
    if (skeleton !== null) {
      const animated = getSkeletonInstanceWithFlagsChanged(skeleton, INSTANCE_ANIMATED_FLAG, 0)
      setSkeletonInstance(
        session,
        data.pillar,
        getSkeletonInstanceWithFlagsChanged(
          startSkeletonInstanceClip(animated, 0, 0),
          0,
          INSTANCE_LOOPING_FLAG
        )
      )
    }
    return Object.freeze({
      ...instance,
      lifecycle: HazardLifecycle.ACTIVE,
      data: Object.freeze({ ...data, isSolid: false }),
    })
  },
  end: (instance) => instance,
  update: (instance, session) => {
    const checked = getActiveAfterEndRequest(instance, (current) => current)
    if (checked === null) return instance
    const { data } = checked
    if (!getIsPillarData(data) || data.isSolid) return checked
    const skeleton = getSkeletonInstance(session, data.pillar)
    if (skeleton === null || !(LANDING_TIME < getSkeletonInstanceTime(skeleton))) return checked
    session.emit({
      type: 'hazard.collision_object_changed',
      name: data.collisionObjectName,
      isSolid: true,
    })
    session.startStopSignal(PILLAR_LANDED_SIGNAL, PILLAR_LANDED_SIGNAL, null)
    return getWithData(checked, { ...data, isSolid: true })
  },
})
