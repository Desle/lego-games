import type { CarDesign } from '@lego-games/lego-racers/car-builder'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import type { Group } from 'three'
import type { CarOrigin, LDrawCarDocument } from './ldraw-car-document.types.ts'

export type LDrawCarDrawing = {
  readonly object: Group
  readonly document: LDrawCarDocument
  readonly origin: CarOrigin
  // Resolves when the car's parts are drawn in the low resolution (or the fallback has been drawn in their place).
  readonly shown: Promise<void>
  // Resolves when the high resolution is there too, the one drawn up close.
  readonly settled: Promise<void>
}

// The design a car's drawing is made from, and the archive that has its bricks' meshes.
export type LDrawCarRequest = {
  readonly archive: JamArchive
  readonly design: CarDesign
}
