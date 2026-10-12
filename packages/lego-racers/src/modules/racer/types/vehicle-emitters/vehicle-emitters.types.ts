import type { EmitterReference } from '../../../emitter/index.ts'
import type { RacerSet } from '../racer.types.ts'

// The racer set after an emitter was spawned, and the handle it returned (null: none free, no such emitter or a one-shot).
export type SpawnedVehicleEmitter = {
  readonly racerSet: RacerSet
  readonly reference: EmitterReference | null
}

// The racer set after a draw of the random cursor, and whether the draw's second bit is set.
export type RandomBit = {
  readonly racerSet: RacerSet
  readonly isSet: boolean
}
