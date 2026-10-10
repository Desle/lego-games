// Keywords of Emitters_Load (LEGORacers.exe 0x00489af0) and its block reader 0x0048a130; emitter offsets
// (0x44 bytes, reset by 0x0048a0e0) in comments.
export const EmitterKeyword = Object.freeze({
  EMITTER: 0x27,
  FIRST_TRUNCATED_VALUE: 0x28, // float truncated to int32, +0x14
  SECOND_TRUNCATED_VALUE: 0x29, // float truncated, low byte at +0x18
  VECTOR: 0x2a, // +0x08..+0x10
  POINTS: 0x2b, // `[ count ] { 3 floats * count }`, +0x00 and +0x04
  FIRST_FLOAT: 0x2c, // +0x1c
  SECOND_FLOAT: 0x2d, // +0x20
  ENTRY_INDEX: 0x2e, // +0x38 points at entry index of the emitter system's 0x18-byte table
  FIRST_INTEGER: 0x2f, // +0x30
  SECOND_INTEGER: 0x30, // +0x34
  THIRD_FLOAT: 0x31, // +0x24
  FOURTH_FLOAT: 0x32, // +0x28
  FIFTH_FLOAT: 0x33, // +0x2c
  LINKED_NAME: 0x34, // looked up with 0x00413200, +0x40
  THIRD_INTEGER: 0x35, // low byte at +0x19
})

export const NAME_MAXIMUM_LENGTH = 8
