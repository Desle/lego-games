// Keywords read by GolDP.dll 0x1001b800 (0x8b..0x8e arrive as extended tokens 0x13).
export const BspVolumeKeyword = Object.freeze({
  MATERIAL_NAMES: 0x27,
  KEYWORD_2D: 0x2d,
  KEYWORD_34: 0x34,
  FLOAT_NODES: 0x8b,
  CHILD_FFFF: 0x8c,
  CHILD_FFFE: 0x8d,
  FIXED_POINT_NODES: 0x8e,
})

// Child values that are not node indices: 0xffff and 0xfffe (0x1001bbb0, 0x1001bd00); 0x1001be50 descends into neither.
export const CHILD_FFFF_INDEX = -1
export const CHILD_FFFE_INDEX = -2
