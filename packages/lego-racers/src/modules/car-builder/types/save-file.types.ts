import type { SaveRacer } from '../../save-data/index.ts'
import type { CarDesign } from './car-builder.types.ts'

// A racer of a save with his design loaded.
export type SavedCar = {
  readonly record: SaveRacer
  readonly design: CarDesign | null
}
