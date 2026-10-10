// Keywords read by GolDP.dll 0x10026270; jump tables at 0x100268ec/0x10026898.
export const MaterialKeyword = Object.freeze({
  MATERIAL: 0x27,
  AMBIENT_COLOR: 0x28,
  DIFFUSE_COLOR: 0x29,
  FLAT_SHADING: 0x2a,
  GOURAUD_SHADING: 0x2b,
  TEXTURE: 0x2c,
  MODULATE_TEXTURE: 0x2d,
  DECAL_TEXTURE: 0x2e,
  ALPHA_TEST: 0x2f,
  BLEND: 0x38,
  LINEAR_FILTERING: 0x44,
  POINT_FILTERING: 0x45,
  OPACITY: 0x46,
  FLAG_0X4000: 0x47,
  WRAP_TEXTURE: 0x48,
  CLAMP_TEXTURE: 0x49,
  FLAG_0X20000: 0x4a,
  FLAG_0X80000: 0x4b,
  FLAG_0X200000: 0x4c,
  SECOND_OPACITY: 0x4d,
  THIRD_OPACITY: 0x4e,
  FOURTH_OPACITY: 0x4f,
  FIFTH_OPACITY: 0x50,
})

// The function index follows ALPHA_TEST (0x30..0x37); 0x10056540 maps it to a D3DCMP value.
export const AlphaFunctionKeyword = Object.freeze({
  FIRST: 0x30,
  ALWAYS: 0x30,
  NEVER: 0x36,
  LAST: 0x37,
})

// Each of the two blend factors following BLEND is one of 0x39..0x43, stored as 0..10.
export const BlendFactorKeyword = Object.freeze({
  FIRST: 0x39,
  LAST: 0x43,
})

// 0x1002641c and the byte stores after it: the definition every material starts from.
export const DEFAULT_MATERIAL_FLAGS = 0x0050a694
export const DEFAULT_ALPHA_FUNCTION = 2
export const DEFAULT_SOURCE_BLEND = 1
export const MATERIAL_NAME_LENGTH = 8
