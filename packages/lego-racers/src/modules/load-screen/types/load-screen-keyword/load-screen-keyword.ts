// Keywords of LoadScreen_Load (LEGORacers.exe 0x0042f480); other keywords inside the block are skipped.
export const LoadScreenKeyword = Object.freeze({
  LOAD_SCREEN: 0x27,
  IMAGE_NAME: 0x28, // copied (9 bytes) and passed to 0x004016d0
  POINTS: 0x29, // `[ count ] { (x y) * count }`, fractions of the screen; load screen +0x14 and +0x18
  STRING_INDEX: 0x2a, // passed to StringTable_GetString (0x0044e540), default 0
})

export const IMAGE_NAME_MAXIMUM_LENGTH = 8
