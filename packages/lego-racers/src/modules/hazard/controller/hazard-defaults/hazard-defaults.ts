import type { HazardBehavior } from '../../types/hazard-behavior.types.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { HazardInstance } from '../../types/hazard-runtime.types.ts'

// The vtable slots most classes leave to the base class or to 0x0046c9f0 (a no-op): not triggered by racers, nothing
// to do after the racers, no reaction to a signal.
export const DEFAULT_HAZARD_SLOTS: Pick<
  HazardBehavior,
  | 'isRacerTriggered'
  | 'updateAfterRacers'
  | 'onSignalStarted'
  | 'touch'
  | 'getRegisteredSphere'
  | 'getCollisionBody'
> = Object.freeze({
  isRacerTriggered: false,
  updateAfterRacers: (instance: HazardInstance) => instance,
  onSignalStarted: (instance: HazardInstance) => instance,
  touch: (instance: HazardInstance) => instance,
  getRegisteredSphere: () => null,
  getCollisionBody: () => null,
})

// 0x0048d470: the common End of the classes that only go back to idle.
export const getIdleHazard = (instance: HazardInstance): HazardInstance =>
  Object.freeze({ ...instance, lifecycle: HazardLifecycle.IDLE })
