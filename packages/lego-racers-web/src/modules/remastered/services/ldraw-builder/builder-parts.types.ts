import type { Group } from 'three'
import type { BuilderBox } from './ldraw-builder.types.ts'

// A part in a colour, ready to copy: its plastic model at the origin and its box in its own frame.
export type PartTemplate = {
  readonly object: Group
  readonly box: BuilderBox
}

export type PartTemplates = {
  // Null when the library has no such part.
  readonly load: (partName: string, colorCode: number) => Promise<PartTemplate | null>
  // Undefined while it has not arrived.
  readonly getLoaded: (partName: string, colorCode: number) => PartTemplate | null | undefined
}
