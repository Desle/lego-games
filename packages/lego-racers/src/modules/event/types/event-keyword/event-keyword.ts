// Sections of Events_Load (LEGORacers.exe 0x0045efa0); each has its own reader and its own array in the event set.
export const EventSectionKeyword = Object.freeze({
  SECTION_28: 0x28, // 0x0045f660, array +0x60, 0x34 bytes
  SECTION_29: 0x29, // 0x0045fa30, array +0x64, 0x34 bytes
  SECTION_2A: 0x2a, // 0x0045f220, array +0x5c, 0x5c bytes
  SECTION_39: 0x39, // 0x00460320, pairs at +0x6c
  SECTION_3D: 0x3d, // 0x0045feb0, array +0x68, 0x64 bytes
  SECTION_42: 0x42, // 0x00460430, array +0x70, 0x34 bytes
  SECTION_4B: 0x4b, // 0x00460ad0, array +0x74, 0x30 bytes
  SECTION_4D: 0x4d, // 0x00460720, array +0x7c, 0x48 bytes
  SECTION_51: 0x51, // 0x00461990, array +0x80, 0x24 bytes
  SECTION_52: 0x52, // 0x00460d10, array +0x78, 0x2c bytes
  SECTION_53: 0x53, // 0x00461070, array +0x84, 0x34 bytes
  SECTION_55: 0x55, // 0x00461430, array +0x88, 0x2c bytes
  SECTION_59: 0x59, // 0x00461670, array +0x8c, 0x38 bytes
})

// Keywords shared by the block readers.
export const EventBlockKeyword = Object.freeze({
  BLOCK: 0x27, // starts a block (and, inside one, the phase signal list)
  BRACED: 0x3c, // between the identifier and the left curly: sets the block's flag
  PHASE_SIGNAL_SECOND: 0x34, // after 0x27 inside a block: second phase signal
  PHASE_SIGNAL_FIRST: 0x36, // after 0x27 inside a block: first phase signal
  PHASE_SIGNAL_THIRD: 0x37, // after 0x27 inside a block: third phase signal
  OBJECT_NAME: 0x33,
  OBJECT_NAME_FROM_SECOND_WORLD: 0x41,
  FLAG_3A: 0x3a,
  FLAG_3F: 0x3f,
  FLAG_2D: 0x2d,
  INTEGER_54: 0x54,
  POSITION: 0x3b,
  LINK: 0x39,
})

export const NAME_MAXIMUM_LENGTH = 8
// Phase signals not given in the file.
export const NO_SIGNAL = -1
