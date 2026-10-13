import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'

export const BuilderItemKind = createEnum({
  CHASSIS: 'chassis',
  CAR: 'car',
})
export type BuilderItemKind = EnumValues<typeof BuilderItemKind>

export type Vector = readonly [number, number, number]

// One thing to build: a chassis recipe (`chassis/<NAME>.ldr`) or a champion's whole car but its wheels (`<CODE>.ldr`).
export type BuilderItem = {
  readonly id: string
  readonly kind: BuilderItemKind
  // The chassis name (lower case) or the car code (upper case).
  readonly name: string
  // The chassis a car's wheels are on (lower case), which gives its wheel guides; for a chassis, its own name.
  readonly chassisName: string
}

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

// A part of the LDraw library, by file name, with the description of its first line.
export type LibraryPart = {
  readonly name: string
  readonly description: string
}

export type BuilderProgress = {
  readonly done: readonly string[]
}

export type BuilderSaveRequest = {
  readonly itemId: string
  readonly text: string
}

export type BuilderSaveResult = {
  readonly path: string
  readonly backupPath: string | null
  readonly progress: BuilderProgress
}

export type PaletteGroup = {
  readonly label: string
  readonly parts: readonly LibraryPart[]
}

export type CommonPartGroup = {
  readonly label: string
  readonly partNames: readonly string[]
}

// Unsaved work kept in the browser: the parts and when they were last changed.
export type BuilderDraft = {
  readonly savedAt: number
  readonly parts: readonly BuilderPart[]
}

// A labelled group of the Start from menu (Cars, Chassis, Backups/drafts).
export type StartFileGroup = {
  readonly label: string
  readonly files: readonly string[]
}
