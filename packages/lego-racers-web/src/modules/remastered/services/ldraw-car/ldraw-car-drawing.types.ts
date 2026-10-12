import type { Group } from 'three'
import type { CarOrigin, LDrawCarDocument } from './ldraw-car-document.types.ts'

export type LDrawCarDrawing = {
  readonly object: Group
  readonly document: LDrawCarDocument
  readonly origin: CarOrigin
  // Resolves when the library has delivered the parts (or the fallback has been drawn in their place).
  readonly settled: Promise<void>
}
