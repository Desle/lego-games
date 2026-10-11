import {
  getIsSkeletonInstanceFinished,
  getSkeletonInstanceWithFlagsChanged,
  INSTANCE_ANIMATED_FLAG,
  INSTANCE_LOOPING_FLAG,
} from '../../../world-animation/index.ts'
import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import type { GateData } from '../../types/hazard-data.types.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type {
  HazardInstance,
  HazardSession,
  InstanceReference,
} from '../../types/hazard-runtime.types.ts'
import { getHazard34 } from '../hazard-definition/hazard-definition.ts'
import { DEFAULT_HAZARD_SLOTS } from '../hazard-defaults/hazard-defaults.ts'
import {
  findSkeletonReference,
  getSkeletonInstance,
  getActiveAfterEndRequest,
  setInstanceDistances,
  setSkeletonInstance,
} from '../hazard-helpers/hazard-helpers.ts'

// A gate has up to four parts.
const PART_COUNT = 4
// The signal the events hear when the gate starts to open (0x0048ef70).
export const GATE_OPENING_SIGNAL = 9

const getIsGateData = (data: HazardInstance['data']): data is GateData =>
  data.keyword === HazardKeyword.HAZARD_34

const changeFlags = (
  session: HazardSession,
  part: InstanceReference | null,
  setMask: number,
  clearMask: number
): void => {
  const skeleton = getSkeletonInstance(session, part)
  if (skeleton !== null) {
    setSkeletonInstance(
      session,
      part,
      getSkeletonInstanceWithFlagsChanged(skeleton, setMask, clearMask)
    )
  }
}

const getIsPartFinished = (session: HazardSession, part: InstanceReference | null): boolean => {
  const skeleton = getSkeletonInstance(session, part)
  return skeleton === null || getIsSkeletonInstanceFinished(skeleton)
}

// 0x0048efe0: when every part has finished its clip they stop animating and the gate is idle again.
const end = (instance: HazardInstance, session: HazardSession): HazardInstance => {
  const { data } = instance
  if (!getIsGateData(data)) return instance
  if (!data.parts.every((part) => getIsPartFinished(session, part))) return instance
  data.parts.forEach((part) => changeFlags(session, part, 0, INSTANCE_ANIMATED_FLAG))
  return Object.freeze({ ...instance, lifecycle: HazardLifecycle.IDLE })
}

// 0x0048ed10 (constructor), 0x0048ee00 (loader), 0x0048ef70 (Begin), 0x0048efe0 (End), 0x0048f030 (update): a gate
// whose parts play their clips once when a signal opens it; its collision object goes away and the events hear
// signal 9. It ends when the first part's clip has finished and every other part has too.
export const GATE: HazardBehavior = Object.freeze({
  ...DEFAULT_HAZARD_SLOTS,
  create: (definition, context) => {
    const { integer, objectName, names } = getHazard34(definition)
    const parts = Array.from({ length: PART_COUNT }, (_, index) => {
      const name = names[index]
      return name === undefined ? null : findSkeletonReference(context.session, 'track', name)
    })
    parts.forEach((part) => changeFlags(context.session, part, 0, INSTANCE_ANIMATED_FLAG))
    return Object.freeze({
      definition,
      identifier: integer ?? 0,
      lifecycle: HazardLifecycle.IDLE,
      data: Object.freeze({
        keyword: HazardKeyword.HAZARD_34,
        parts: Object.freeze(parts),
        collisionObjectName: objectName ?? '',
      } satisfies GateData),
    })
  },
  begin: (instance, session) => {
    const { data } = instance
    if (!getIsGateData(data)) return instance
    data.parts.forEach((part) => {
      setInstanceDistances(session, part, [0, 0, 0])
      changeFlags(session, part, INSTANCE_ANIMATED_FLAG, INSTANCE_LOOPING_FLAG)
    })
    session.startStopSignal(GATE_OPENING_SIGNAL, GATE_OPENING_SIGNAL, null)
    return Object.freeze({ ...instance, lifecycle: HazardLifecycle.ACTIVE })
  },
  end,
  update: (instance, session) => {
    const checked = getActiveAfterEndRequest(instance, (current) => end(current, session))
    if (checked === null) return instance
    const { data } = checked
    if (!getIsGateData(data)) return checked
    if (data.collisionObjectName !== '') {
      session.emit({
        type: 'hazard.collision_object_changed',
        name: data.collisionObjectName,
        isSolid: false,
      })
    }
    const [first] = data.parts
    if (first === null || first === undefined || !getIsPartFinished(session, first)) return checked
    return end(checked, session)
  },
})
