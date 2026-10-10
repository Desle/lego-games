import { createEnum } from '../../../../shared/types/enum.types.ts'

// The vertex buffer classes a GDB keyword creates (constructors 0x100156d0, 0x10016b80, 0x10005f90, 0x1002be00).
export const VertexFormat = createEnum({
  POSITION_TEXTURE: 'position_texture',
  POSITION_TEXTURE_NORMAL: 'position_texture_normal',
  POSITION_TEXTURE_COLOR: 'position_texture_color',
  POSITION: 'position',
})
