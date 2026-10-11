import type { Model } from '../../model/index.ts'
import type { BodyPartCatalog, PartGeometry } from './figure-builder.types.ts'

// What makes a driver's model: the catalogue, the geometry file of the game's parts (`GAMEPART\ICB_CHAR.GCB`), the body
// model (`GAMEPART\LEG_BOX.GDB`) and the five part bytes of the racer's save (hat, face, torso, legs, expression), in the
// order 0x0042b330 hands them over.
export type DriverModelRequest = {
  readonly catalog: BodyPartCatalog
  readonly geometry: PartGeometry
  readonly body: Model
  readonly partBytes: readonly number[]
}
