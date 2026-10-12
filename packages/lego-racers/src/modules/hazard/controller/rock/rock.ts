import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import type { RockData } from '../../types/hazard-data.types.ts'
import { HazardKeyword } from '../../types/hazard-keyword/hazard-keyword.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { HazardInstance, HazardSession } from '../../types/hazard-runtime.types.ts'
import { DEFAULT_HAZARD_SLOTS } from '../hazard-defaults/hazard-defaults.ts'
import {
  findMeshReference,
  getInstanceDistances,
  getMeshInstance,
  getSphereWhileRegistered,
  getActiveAfterEndRequest,
  getWithData,
  setInstanceDistances,
} from '../hazard-helpers/hazard-helpers.ts'

// 0x0048e3a0: the identifier 1.
export const ROCK_IDENTIFIER = 1
// The signal the rock holds while it is in its second form (0x0048e5a0, 0x0048e600).
export const ROCK_SIGNAL = 0x23
// 0x004b4548: a level distance below zero hides the instance.
const HIDDEN_DISTANCE = -1
// Racer flag 0x1 (+0xd04): shielded.
const SHIELDED_FLAG = 1
const LEVEL_COUNT = 3
const OFF_NAME = 'mmrocof'
const ON_NAME = 'mmrocon'
const COLLISION_OBJECT_NAME = 'mmrocc'
// 0x004b4568: the radius of the shape, which stays where the "mmrocof" mesh instance is.
const SHAPE_RADIUS = 350
const ORIGIN = Object.freeze([0, 0, 0] as const)

const getIsRockData = (data: HazardInstance['data']): data is RockData =>
  data.keyword === HazardKeyword.HAZARD_2E

const getHiddenDistances = (): readonly number[] =>
  Array.from({ length: LEVEL_COUNT }, () => HIDDEN_DISTANCE)

// 0x0048e600: the "on" mesh is hidden, the "off" mesh shows at its saved distances, the signal stops and the
// collision object is solid.
const turnOff = (session: HazardSession, data: RockData): void => {
  setInstanceDistances(session, data.onInstance, getHiddenDistances())
  setInstanceDistances(session, data.offInstance, data.savedDistances)
  session.stopSignal(ROCK_SIGNAL, null)
  session.emit({
    type: 'hazard.collision_object_changed',
    name: data.collisionObjectName,
    isSolid: true,
  })
}

// 0x0048e5a0: the other way round, and the collision object goes away.
const turnOn = (session: HazardSession, data: RockData): void => {
  setInstanceDistances(session, data.onInstance, data.savedDistances)
  setInstanceDistances(session, data.offInstance, getHiddenDistances())
  session.startSignal(ROCK_SIGNAL, null)
  session.emit({
    type: 'hazard.collision_object_changed',
    name: data.collisionObjectName,
    isSolid: false,
  })
}

const end = (instance: HazardInstance, session: HazardSession): HazardInstance => {
  const { data } = instance
  if (!getIsRockData(data)) return instance
  turnOff(session, data)
  return Object.freeze({ ...instance, lifecycle: HazardLifecycle.IDLE })
}

// 0x0048e2a0 (constructor), 0x0048e3a0 (loader), 0x0048e660 (touch), 0x0048e530 (update): a rock with two forms. Begin
// registers its sphere (radius 350 at the "off" mesh). A shielded racer that touches it asks for the swap; the next update turns it on when its "on" mesh is hidden.
export const ROCK: HazardBehavior = Object.freeze({
  ...DEFAULT_HAZARD_SLOTS,
  create: (definition, context) => {
    const { session } = context
    const offInstance = findMeshReference(session, 'track', OFF_NAME)
    const data: RockData = {
      keyword: HazardKeyword.HAZARD_2E,
      offInstance,
      onInstance: findMeshReference(session, 'track', ON_NAME),
      savedDistances: Object.freeze([...(getInstanceDistances(session, offInstance) ?? [])]),
      collisionObjectName: COLLISION_OBJECT_NAME,
      flag: 1,
      sphere: Object.freeze({
        centre: getMeshInstance(session, offInstance)?.position ?? ORIGIN,
        radius: SHAPE_RADIUS,
      }),
    }
    turnOff(session, data)
    return Object.freeze({
      definition,
      identifier: ROCK_IDENTIFIER,
      lifecycle: HazardLifecycle.IDLE,
      data: Object.freeze(data),
    })
  },
  begin: (instance) => Object.freeze({ ...instance, lifecycle: HazardLifecycle.ACTIVE }),
  end,
  getRegisteredSphere: (instance) =>
    getIsRockData(instance.data) ? getSphereWhileRegistered(instance, instance.data.sphere) : null,
  touch: (instance, _session, racer) => {
    const { data } = instance
    if (!getIsRockData(data) || (racer.flags & SHIELDED_FLAG) === 0) return instance
    return getWithData(instance, { ...data, flag: 0 })
  },
  update: (instance, session) => {
    const checked = getActiveAfterEndRequest(instance, (current) => end(current, session))
    if (checked === null) return instance
    const { data } = checked
    if (!getIsRockData(data)) return checked
    if (data.flag === 0) {
      if (getInstanceDistances(session, data.onInstance)?.[0] === HIDDEN_DISTANCE) {
        turnOn(session, data)
        return getWithData(checked, { ...data, flag: 1 })
      }
    } else if (
      data.flag === 1 &&
      getInstanceDistances(session, data.offInstance)?.[0] === HIDDEN_DISTANCE
    ) {
      turnOff(session, data)
    }
    return getWithData(checked, { ...data, flag: 1 })
  },
})
