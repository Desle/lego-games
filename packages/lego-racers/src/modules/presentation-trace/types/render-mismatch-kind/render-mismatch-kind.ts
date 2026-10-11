import { createEnum } from '../../../../shared/types/enum.types.ts'

// How a triangle of the port differs from the original's.
export const RenderMismatchKind = createEnum({
  MISSING_IN_PORT: 'missing_in_port',
  EXTRA_IN_PORT: 'extra_in_port',
  WINDING: 'winding',
  TEXTURE_COORDINATES: 'texture_coordinates',
  TEXTURE: 'texture',
  STATE: 'state',
  COLOR: 'color',
  POSITION: 'position',
})
