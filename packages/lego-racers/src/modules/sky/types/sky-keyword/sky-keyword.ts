// Keywords of Sky_Load (LEGORacers.exe 0x0041c550); keyframe offsets (0x10 bytes) in comments.
export const SkyKeyword = Object.freeze({
  SETTING: 0x27, // also starts each keyframe block
  INTEGER: 0x28, // +0x00, reset to 1000
  FIRST_BYTES: 0x29, // +0x04..+0x06, reset to 0xff
  SECOND_BYTES: 0x2a, // +0x08..+0x0a, reset to 0xff
  THIRD_BYTES: 0x2b, // +0x0c..+0x0e, reset to 0xff
  SETTINGS: 0x2c,
  SELECTED_SETTING: 0x2d, // name looked up among the settings; index at sky +0xb8, 0 when absent or unknown
  FLOAT: 0x2e, // sky +0xac
})

export const NAME_MAXIMUM_LENGTH = 8
export const DEFAULT_INTEGER = 1000
export const DEFAULT_BYTE = 0xff
