import type { BufferGeometry, Material, Matrix4 } from 'three'
import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { EnumValues } from '../../../../shared/types/enum.types.ts'

export const MergedPrimitiveKind = createEnum({
  TRIANGLES: 'triangles',
  LINES: 'lines',
  CONDITIONAL_LINES: 'conditional_lines',
})
export type MergedPrimitiveKind = EnumValues<typeof MergedPrimitiveKind>

// A run of vertices of one geometry that one material draws, and where it sits in the model.
export type GeometryChunk = {
  readonly geometry: BufferGeometry
  readonly start: number
  readonly count: number
  readonly matrix: Matrix4
  readonly isMirrored: boolean
}

export type MergeBucket = {
  readonly material: Material
  // The meshes it merges had a list of materials (a part of several colours): the plastic look leaves those as the library made them.
  readonly isMaterialList: boolean
  readonly kind: MergedPrimitiveKind
  readonly chunks: GeometryChunk[]
}
