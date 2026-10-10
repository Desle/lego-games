// Keywords read by GolDP.dll 0x10023060; jump table 0x1002338c (0x28..0x2c).
export const ImageDatabaseKeyword = Object.freeze({
  IMAGE: 0x27,
  FLAG_0X4: 0x28,
  FLAG_0X8: 0x29,
  FLAG_0X10: 0x2a,
  KEYWORD_2B: 0x2b,
  KEYWORD_2C: 0x2c,
})

// 0x100232fd: flag 0x20 (keyword 0x2b) also sets 0x800.
export const IMAGE_KEYWORD_2B_FLAG = 0x20
export const IMAGE_KEYWORD_2B_EXTRA_FLAG = 0x800
export const IMAGE_NAME_LENGTH = 8
