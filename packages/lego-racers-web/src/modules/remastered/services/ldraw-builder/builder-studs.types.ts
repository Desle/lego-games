import type { Vector } from './ldraw-builder.types.ts'

// A stud of a part: the centre of its base and the way it points, in the part's frame (or, placed, in the editing frame).
export type PartStud = {
  readonly position: Vector
  readonly direction: Vector
}

// Reads a library file by the name a part line gives it (`s\3001s01.dat`, `stud.dat`); null when there is none.
export type LibraryFileReader = (name: string) => Promise<string | null>

export type PartStudLists = {
  readonly load: (partName: string) => Promise<readonly PartStud[]>
  // Undefined while it has not arrived.
  readonly getLoaded: (partName: string) => readonly PartStud[] | undefined
}
