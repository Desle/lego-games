import type { Group } from 'three'
import type { CarOrigin, LDrawCarDocument } from './ldraw-car-document.types.ts'

export type LDrawCarDrawing = {
  readonly object: Group
  readonly document: LDrawCarDocument
  readonly origin: CarOrigin
  // Resolves when the library has delivered the parts (or the fallback has been drawn in their place).
  readonly settled: Promise<void>
}

// What a car that is not a built design adds: the origin its frame has (a built car's comes from its first brick), and more
// lines of the LDraw model besides the design's bricks.
export type LDrawCarDrawingOptions = {
  readonly origin: CarOrigin | null
  readonly extraText: string
}
