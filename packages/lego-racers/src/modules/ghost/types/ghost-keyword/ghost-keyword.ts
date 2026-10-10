// Keywords of Ghost_Load (LEGORacers.exe 0x00423160); ghost data offsets in comments.
export const GhostKeyword = Object.freeze({
  SAMPLES: 0x27, // count at +0x2598, 10-byte samples from +0x0c
  START_POSITION: 0x28, // +0x25a0..+0x25a8
  START_QUATERNION: 0x29, // +0x25ac..+0x25b8
  FIRST_INTEGERS: 0x2a, // +0x00..+0x08
  GHOST: 0x2c,
  SECOND_INTEGER: 0x2b, // +0x259c
})

// GhostRecorder_RecordSample (0x00422710) records while the count is below 0x3c1; more would overwrite +0x2598.
export const MAXIMUM_SAMPLE_COUNT = 0x3c1
export const SAMPLE_BYTE_COUNT = 4
