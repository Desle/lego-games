import type { BuilderBox, Vector } from './ldraw-builder.types.ts'

// A stud of a part: the centre of its base and the way it points, in the part's frame (or, placed, in the editing frame).
export type PartStud = {
  readonly position: Vector
  readonly direction: Vector
}

// What placement needs of a part's geometry, in its own frame: its studs, the box of its faces, its footprint (the extent of its lowest
// level faces under its studs; null without level faces) and its bottom (how far down it reaches under its upward studs; null without).
export type PartShape = {
  readonly studs: readonly PartStud[]
  readonly box: BuilderBox | null
  readonly footprint: BuilderBox | null
  readonly bottom: number | null
}

// Reads a library file by the name a part line gives it (`s\3001s01.dat`, `stud.dat`); null when there is none.
export type LibraryFileReader = (name: string) => Promise<string | null>

export type PartStudLists = {
  readonly load: (partName: string) => Promise<readonly PartStud[]>
  // Undefined while it has not arrived.
  readonly getLoaded: (partName: string) => readonly PartStud[] | undefined
}

export type PartShapes = {
  readonly load: (partName: string) => Promise<PartShape>
  // Undefined while it has not arrived.
  readonly getLoaded: (partName: string) => PartShape | undefined
}

// What a walk through a part's files finds: its studs and its faces (each a triangle or quad of points), in the part's frame.
export type CollectedGeometry = {
  readonly studs: readonly PartStud[]
  readonly faces: readonly (readonly Vector[])[]
}

// The anti-stud grid a footprint gives, turned as the part is: one anti-stud's centre (at the footprint's level), how many studs it
// covers and its box.
export type FootprintGrid = {
  readonly point: Vector
  readonly count: number
  readonly box: BuilderBox
}
