import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type {
  HazardInstance,
  HazardLoadContext,
  HazardRacer,
  HazardRuntime,
  HazardSession,
  HazardSphere,
  HazardStore,
} from '../../types/hazard-runtime.types.ts'
import type { HazardList, Vector3 } from '../../types/hazard.types.ts'
import { getHazardBehavior } from '../hazard-registry/hazard-registry.ts'
import { NO_IDENTIFIER } from '../hazard-helpers/hazard-helpers.ts'

export const EMPTY_HAZARD_RUNTIME: HazardRuntime = Object.freeze({ instances: Object.freeze([]) })

// Hazards_Load 0x0048a4d0 after the file: every definition becomes its class's object, in file order; a loader may
// draw from the random table (class 0x2d does, through its Begin) and change the worlds.
export const createHazardRuntime = (
  list: HazardList | null,
  context: HazardLoadContext
): HazardRuntime =>
  list === null
    ? EMPTY_HAZARD_RUNTIME
    : Object.freeze({
        instances: Object.freeze(
          list.hazards.map((definition) =>
            getHazardBehavior(definition.keyword).create(definition, context)
          )
        ),
      })

const getBehavior = (instance: HazardInstance): HazardBehavior =>
  getHazardBehavior(instance.definition.keyword)

// Runs a function on the hazard at an index and stores the result there, as the original changes the object in
// place while the bus is still walking the array (a re-entrant change to the same hazard is overwritten).
const apply = (
  store: HazardStore,
  index: number,
  run: (instance: HazardInstance) => HazardInstance
): void => {
  const instance = store.get().instances[index]
  if (instance === undefined) return
  const result = run(instance)
  store.set(
    Object.freeze({
      instances: Object.freeze(
        store.get().instances.map((current, position) => (position === index ? result : current))
      ),
    })
  )
}

const forEach = (store: HazardStore, visit: (index: number) => void): void => {
  for (let index = 0; index < store.get().instances.length; index += 1) visit(index)
}

// 0x0048a470: begin an idle hazard.
const beginIfIdle = (
  store: HazardStore,
  session: HazardSession,
  index: number,
  racer: HazardRacer | null
): void =>
  apply(store, index, (instance) =>
    instance.lifecycle === HazardLifecycle.IDLE
      ? getBehavior(instance).begin(instance, session, racer)
      : instance
  )

// 0x0048a490: end a hazard that is not idle.
const endIfNotIdle = (
  store: HazardStore,
  session: HazardSession,
  index: number,
  racer: HazardRacer | null
): void =>
  apply(store, index, (instance) =>
    instance.lifecycle !== HazardLifecycle.IDLE
      ? getBehavior(instance).end(instance, session, racer)
      : instance
  )

const getIsAddressed = (store: HazardStore, index: number, identifier: number): boolean => {
  const current = store.get().instances[index]?.identifier
  return current !== undefined && current !== NO_IDENTIFIER && current === identifier
}

const getIsRacerTriggeredAndAddressed = (
  store: HazardStore,
  index: number,
  identifier: number
): boolean => {
  const instance = store.get().instances[index]
  return (
    instance !== undefined &&
    getIsAddressed(store, index, identifier) &&
    getBehavior(instance).isRacerTriggered
  )
}

const notifySignalStarted = (
  store: HazardStore,
  session: HazardSession,
  index: number,
  identifier: number,
  parameter: Vector3 | null
): void =>
  apply(store, index, (instance) =>
    getBehavior(instance).onSignalStarted(instance, session, identifier, parameter)
  )

// A racer touched a hazard that sits in the collision registry (vtable +0x00): the registry's walk found its sphere
// overlapping the racer's volume.
export const touchHazard = (
  store: HazardStore,
  session: HazardSession,
  hazardIndex: number,
  racer: HazardRacer
): void =>
  apply(store, hazardIndex, (instance) => getBehavior(instance).touch(instance, session, racer))

// The shape of the hazard at an index while it sits in the collision registry (its Begin registers it, its End ends
// the entry), or null.
export const getHazardRegisteredSphere = (
  runtime: HazardRuntime,
  hazardIndex: number
): HazardSphere | null => {
  const instance = runtime.instances[hazardIndex]
  return instance === undefined ? null : getBehavior(instance).getRegisteredSphere(instance)
}

// Hazards_Update 0x0048add0.
export const updateHazards = (
  store: HazardStore,
  session: HazardSession,
  milliseconds: number
): void =>
  forEach(store, (index) =>
    apply(store, index, (instance) => getBehavior(instance).update(instance, session, milliseconds))
  )

// 0x0048ae00, after the racers: the hazards that follow the cameras.
export const updateHazardsAfterRacers = (
  store: HazardStore,
  session: HazardSession,
  cameraPositions: readonly Vector3[]
): void =>
  forEach(store, (index) =>
    apply(store, index, (instance) =>
      getBehavior(instance).updateAfterRacers(instance, session, cameraPositions)
    )
  )

// 0x0048aad0: Events_StartSignal.
export const startHazardSignal = (
  store: HazardStore,
  session: HazardSession,
  identifier: number,
  parameter: Vector3 | null
): void =>
  forEach(store, (index) => {
    if (getIsAddressed(store, index, identifier)) beginIfIdle(store, session, index, null)
    notifySignalStarted(store, session, index, identifier, parameter)
  })

// 0x0048abb0: Events_StartStopSignal.
export const startStopHazardSignal = (
  store: HazardStore,
  session: HazardSession,
  startIdentifier: number,
  stopIdentifier: number,
  parameter: Vector3 | null
): void =>
  forEach(store, (index) => {
    if (getIsAddressed(store, index, startIdentifier)) beginIfIdle(store, session, index, null)
    if (getIsAddressed(store, index, stopIdentifier)) endIfNotIdle(store, session, index, null)
    notifySignalStarted(store, session, index, startIdentifier, parameter)
  })

// 0x0048ab20: Events_StopSignal.
export const stopHazardSignal = (
  store: HazardStore,
  session: HazardSession,
  identifier: number
): void =>
  forEach(store, (index) => {
    if (getIsAddressed(store, index, identifier)) endIfNotIdle(store, session, index, null)
  })

// 0x0048ab70: Events_ForceEnd marks the hazards for ending.
export const forceEndHazards = (store: HazardStore, identifier: number): void =>
  forEach(store, (index) => {
    if (getIsAddressed(store, index, identifier)) {
      apply(store, index, (instance) =>
        Object.freeze({ ...instance, lifecycle: HazardLifecycle.ENDING })
      )
    }
  })

// 0x0048ac30: a racer fired a trigger; only racer-triggered hazards begin.
export const fireHazardTrigger = (
  store: HazardStore,
  session: HazardSession,
  identifier: number,
  racer: HazardRacer
): void =>
  forEach(store, (index) => {
    if (getIsRacerTriggeredAndAddressed(store, index, identifier)) {
      beginIfIdle(store, session, index, racer)
    }
    notifySignalStarted(store, session, index, identifier, racer.position)
  })

// 0x0048ad10: a racer fired one trigger and released another.
export const fireReleaseHazardTrigger = (
  store: HazardStore,
  session: HazardSession,
  fireIdentifier: number,
  releaseIdentifier: number,
  racer: HazardRacer
): void =>
  forEach(store, (index) => {
    if (getIsRacerTriggeredAndAddressed(store, index, fireIdentifier)) {
      beginIfIdle(store, session, index, racer)
    }
    if (getIsRacerTriggeredAndAddressed(store, index, releaseIdentifier)) {
      endIfNotIdle(store, session, index, racer)
    }
    notifySignalStarted(store, session, index, fireIdentifier, racer.position)
  })

// 0x0048aca0: a racer released a trigger.
export const releaseHazardTrigger = (
  store: HazardStore,
  session: HazardSession,
  identifier: number,
  racer: HazardRacer
): void =>
  forEach(store, (index) => {
    if (getIsRacerTriggeredAndAddressed(store, index, identifier)) {
      endIfNotIdle(store, session, index, racer)
    }
  })
