import type { Hazard, Vector3 } from './hazard.types.ts'
import type {
  HazardInstance,
  HazardLoadContext,
  HazardRacer,
  HazardSession,
} from './hazard-runtime.types.ts'

// What a hazard class implements: its vtable (0x004b4194 and the other nineteen).
export type HazardBehavior = {
  // Vtable +0x20: only class 0x49 answers non-zero, and only such hazards begin and end for a racer's trigger.
  readonly isRacerTriggered: boolean
  // +0x10, with the constructor: the object a freshly loaded hazard is.
  readonly create: (definition: Hazard, context: HazardLoadContext) => HazardInstance
  // +0x04 and +0x08; the racer is null when a signal started or ended it.
  readonly begin: (
    instance: HazardInstance,
    session: HazardSession,
    racer: HazardRacer | null
  ) => HazardInstance
  readonly end: (
    instance: HazardInstance,
    session: HazardSession,
    racer: HazardRacer | null
  ) => HazardInstance
  // +0x14, called every frame between the events and the timers.
  readonly update: (
    instance: HazardInstance,
    session: HazardSession,
    milliseconds: number
  ) => HazardInstance
  // +0x18, called after the racers with the player cameras' positions.
  readonly updateAfterRacers: (
    instance: HazardInstance,
    session: HazardSession,
    cameraPositions: readonly Vector3[]
  ) => HazardInstance
  // Vtable +0x00 of the objects that sit in the collision registry: a racer touched the hazard.
  readonly touch: (
    instance: HazardInstance,
    session: HazardSession,
    racer: HazardRacer
  ) => HazardInstance
  // +0x28: a signal with the given identifier started, with the position that came with it.
  readonly onSignalStarted: (
    instance: HazardInstance,
    session: HazardSession,
    identifier: number,
    parameter: Vector3 | null
  ) => HazardInstance
}

// A hazard's registered behaviour: the vtable keyed by keyword.
export type HazardBehaviorTable = Readonly<Record<number, HazardBehavior>>
