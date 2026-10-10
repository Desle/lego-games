// Keywords of Drivers_Load (LEGORacers.exe 0x004208f0); the record offset of each value is in the comment.
export const DriverKeyword = Object.freeze({
  DRIVERS: 0x27,
  MATERIAL_LIBRARY: 0x28, // +0x02, name of at most eight characters
  TEXTURE_DATABASE: 0x29, // +0x0a
  MODEL: 0x2a, // +0x12
  CHAMPION: 0x2b, // +0x1a
  PERSONALITY_FIRST: 0x2c, // +0x24, integer kept as a byte
  PERSONALITY_SECOND: 0x2d, // +0x25
  PERSONALITY_THIRD: 0x2e, // +0x26
  PERSONALITY_FOURTH: 0x2f, // +0x27
  PERSONALITY_FIFTH: 0x30, // +0x28
  PERSONALITY_SIXTH: 0x31, // +0x29
  NAME_STRING_IDENTIFIER: 0x33, // +0x00, integer kept as a 16-bit value
  VOICE_NUMBER: 0x34, // +0x2a
  UNREAD_FIRST: 0x35, // +0x2b
  UNREAD_SECOND: 0x36, // +0x2c
  UNREAD_THIRD: 0x37, // +0x2d
  UNREAD_FOURTH: 0x38, // +0x2e
  UNREAD_FIFTH: 0x39, // +0x2f
  PREFERRED_POWER_UP: 0x3a, // +0x22 and +0x23, two integers
})
