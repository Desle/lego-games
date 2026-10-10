// Keywords of PowerUps_Load (LEGORacers.exe 0x00458810) and its list readers 0x00458a80 and 0x00458e80.
export const PowerUpKeyword = Object.freeze({
  BRICK: 0x27,
  POSITION: 0x28,
  BRICK_KIND_1: 0x2a,
  BRICK_KIND_4: 0x2b,
  BRICK_KIND_2: 0x2c,
  BRICK_KIND_3: 0x2d,
  IDENTIFIER: 0x2e,
  ENHANCEMENT_BRICK: 0x2f,
  // Both are read and dropped: a string of at most 8 characters and an integer, or an integer.
  IGNORED_NAME_AND_INTEGER: 0x30,
  IGNORED_INTEGER: 0x31,
})

// 0x00458a80: a brick block starts with kind 3 and identifier -1, stored at brick +0x48 only when not negative.
export const DEFAULT_BRICK_KIND = 3
export const DEFAULT_IDENTIFIER = -1
export const IGNORED_NAME_MAXIMUM_LENGTH = 8
