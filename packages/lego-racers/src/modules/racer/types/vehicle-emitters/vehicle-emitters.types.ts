import type { EmitterReference } from '../../../emitter/index.ts'
import type { RacerSet } from '../racer.types.ts'

// The racer set after an emitter was spawned, and the handle it returned (null: none free, no such emitter or a one-shot).
export type SpawnedVehicleEmitter = {
  readonly racerSet: RacerSet
  readonly reference: EmitterReference | null
}
