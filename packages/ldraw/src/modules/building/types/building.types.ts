export type Vector = readonly [number, number, number]

// A placed part: an LDraw type 1 line, in LDraw units and axes.
export type BuilderPart = {
  readonly colorCode: number
  readonly position: Vector
  // Row-major 3 x 3 rotation (a b c d e f g h i of the line).
  readonly rotation: readonly number[]
  readonly partName: string
  // The comment lines that stood right before the part in the file, kept with it.
  readonly commentLines: readonly string[]
}

// A part line before it is placed in a document (no comments of its own yet).
export type BuilderPartLine = Omit<BuilderPart, 'commentLines'>

// A model file split for editing: its header, the lines that place other models (kept as they are; a car's chassis recipe is made its own parts), the
// parts, and the lines the builder does not edit (kept as they are, at the end).
export type BuilderDocument = {
  readonly headerLines: readonly string[]
  readonly referenceLines: readonly string[]
  readonly parts: readonly BuilderPart[]
  readonly keptLines: readonly string[]
}

export type BuilderHistory = {
  readonly past: readonly (readonly BuilderPart[])[]
  readonly present: readonly BuilderPart[]
  readonly future: readonly (readonly BuilderPart[])[]
}

export type BuilderBox = {
  readonly minimum: Vector
  readonly maximum: Vector
}

// What the cursor points at, in the editing frame: the point, the face's normal, and the grid of the part it is on (the remainder of
// its box's corner by a stud in x and z, of its origin by a plate in y).
export type PlacementTarget = {
  readonly point: Vector
  readonly normal: Vector
  readonly phase: Vector
}
