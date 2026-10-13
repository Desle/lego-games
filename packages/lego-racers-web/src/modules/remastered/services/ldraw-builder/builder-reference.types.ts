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
}

export type BuilderItemStart = {
  // Where Done writes, relative to the models folder.
  readonly file: string
  // The file the model was read from, null when it starts empty.
  readonly sourceFile: string | null
  readonly document: BuilderDocument
  // Where the editing frame sits in the car's frame (LDraw units and axes): a chassis recipe's offset, nothing for a car.
  readonly editOffset: Vector
}
