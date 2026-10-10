import { createEnum } from '../../../../shared/types/enum.types.ts'

// The three-bit tag of a packed command (GolDP.dll 0x10027430), as the renderer at 0x10006c50 reads it.
export const ModelCommandKind = createEnum({
  TRANSFORM_VERTICES: 'transform_vertices',
  DRAW_FACES: 'draw_faces',
  SELECT_MATERIAL: 'select_material',
  SELECT_TRANSFORM: 'select_transform',
})
