import type { CarDesign } from '@lego-games/lego-racers/car-builder'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import type { Group } from 'three'
import type { CarOrigin, LDrawCarDocument } from './ldraw-car-document.types.ts'

export type LDrawCarDrawing = {
  readonly object: Group
  readonly document: LDrawCarDocument
  readonly origin: CarOrigin
  // Resolves when the library has delivered the parts (or the fallback has been drawn in their place).
  readonly settled: Promise<void>
}

// The design a car's drawing is made from, and the archive that has its bricks' meshes.
export type LDrawCarRequest = {
  readonly archive: JamArchive
  readonly design: CarDesign
}
