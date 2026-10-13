import type { Group } from 'three'
import type { BuilderDocument, BuilderPart, Vector } from './ldraw-builder.types.ts'

export type OriginalReference = {
  readonly object: Group
  readonly dispose: () => void
}

export type BuilderItemStart = {
  // Where Done writes, relative to the models folder.
  readonly file: string
  // The file the model was read from, null when it starts empty.
  readonly sourceFile: string | null
  readonly document: BuilderDocument
  readonly lockedParts: readonly BuilderPart[]
  // Where the editing frame sits in the car's frame (LDraw units and axes): a chassis recipe's offset, nothing for a car.
  readonly editOffset: Vector
}
