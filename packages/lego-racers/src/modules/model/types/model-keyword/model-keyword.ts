// Top-level keywords dispatched by GolDP.dll 0x100270e0.
export const ModelKeyword = Object.freeze({
  MATERIALS: 0x27,
  POSITION_TEXTURE_VERTICES: 0x28,
  POSITION_TEXTURE_NORMAL_VERTICES: 0x29,
  POSITION_TEXTURE_COLOR_VERTICES: 0x2a,
  FACES: 0x2d,
  COMMANDS: 0x2e,
  SCALE: 0x33,
  POSITION_VERTICES: 0x34,
})

// Keywords inside the command list, read by GolDP.dll 0x10027430.
export const ModelCommandKeyword = Object.freeze({
  SELECT_MATERIAL: 0x27,
  DRAW_FACES: 0x2d,
  PUSH_TRANSFORM: 0x2f,
  POP_TRANSFORM: 0x30,
  TRANSFORM_VERTICES: 0x31,
  SET_TRANSFORM: 0x32,
})
