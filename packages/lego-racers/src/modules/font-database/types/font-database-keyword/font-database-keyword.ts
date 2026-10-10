// Keywords read by GolDP.dll 0x1001d8f0; jump table 0x1001dd04 (0x28..0x2d).
export const FontDatabaseKeyword = Object.freeze({
  FONT: 0x27,
  FLAG_0X8: 0x28,
  FLAG_0X10: 0x29,
  KEYWORD_2A: 0x2a,
  CHARACTERS: 0x2b,
  KEYWORD_2C: 0x2c,
  KEYWORD_2D: 0x2d,
})

// 0x1001dc1f: flag 0x20 (keyword 0x2a) also sets 0x800.
export const FONT_KEYWORD_2A_FLAG = 0x20
export const FONT_KEYWORD_2A_EXTRA_FLAG = 0x800
export const FONT_NAME_LENGTH = 8
// 0x1001dd20 collects characters into a 200-byte stack buffer of the loader (ESP + 0x34).
export const FONT_CHARACTER_CAPACITY = 100
