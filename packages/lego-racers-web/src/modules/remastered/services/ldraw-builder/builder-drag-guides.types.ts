import type { Group } from 'three'
import type { DragGuide } from './builder-drag.types.ts'
import type { Vector } from './ldraw-builder.types.ts'

// The marks a drag draws in the editing frame: a dot on the connection the part joins and the guide line.
export type DragGuides = {
  readonly object: Group
  readonly show: (target: Vector | null, guide: DragGuide | null) => void
}
