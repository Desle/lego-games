import type { Box3, Group } from 'three'
import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'
import type { BuilderDocument, Vector } from './ldraw-builder.types.ts'

// What the original's model gives to build against: a solid shape, an effect (a see-through, flat or unposed mesh the race animates,
// whose shape is only a guide), or nothing to show.
export const ReferenceShape = createEnum({
  SOLID: 'solid',
  EFFECT: 'effect',
  NONE: 'none',
})
export type ReferenceShape = EnumValues<typeof ReferenceShape>

export type OriginalReference = {
  readonly object: Group
  readonly dispose: () => void
  // The bounds of what is shown, in the builder's world (studs, z up).
  readonly bounds: Box3
  readonly shape: ReferenceShape
  // The scale (powerup-object-frame.ts) that fits a file with these bounds (LDraw units and axes) to the original.
  readonly getFittedScale: (fileBounds: Box3) => number
}

export type BuilderItemStart = {
  // Where Done writes, relative to the models folder.
  readonly file: string
  // The file the model was read from, null when it starts empty.
  readonly sourceFile: string | null
  // The document without its scale line.
  readonly document: BuilderDocument
  // The file's scale line's factor, null when it has none (a power-up object is then fitted, a particle real size).
  readonly scale: number | null
  // Where the editing frame sits in the car's frame (LDraw units and axes): a chassis recipe's offset, nothing for a car.
  readonly editOffset: Vector
}
