// Keywords of Checkpoints_Load (LEGORacers.exe 0x0041e770) and its block reader 0x0041e640.
export const CheckpointKeyword = Object.freeze({
  CHECKPOINT: 0x27,
  PLANE: 0x28, // +0x00..+0x0c
  LINKS: 0x29, // +0x20..+0x23
  POINT: 0x2a, // +0x10..+0x18
})

// 0x0041e856: more than 254 checkpoints is fatal.
export const MAXIMUM_CHECKPOINT_COUNT = 0xfe
export const LINK_COUNT = 4
export const NO_LINK = 0xff
// 0x0041e600 resets the progress to -1.0 (0x004afaec marks "not assigned yet").
export const UNASSIGNED_PROGRESS = -1
