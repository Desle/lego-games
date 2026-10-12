import type { LDrawBrickColor } from './ldraw-brick-mappings.types.ts'

// The colours of `L_COLORS.LEB` by index: black white biege ltgray dkgray red brown yellow green blue. The 1999 game predates
// the library's bluish greys, so the grey codes are the library's original ones (7 and 8); biege is tan (19).
export const LDRAW_BRICK_COLORS: readonly LDrawBrickColor[] = Object.freeze([
  Object.freeze({ code: 0, hex: 0x05131d }),
  Object.freeze({ code: 15, hex: 0xf2f3f2 }),
  Object.freeze({ code: 19, hex: 0xe4cd9e }),
  Object.freeze({ code: 7, hex: 0x9ba19d }),
  Object.freeze({ code: 8, hex: 0x6d6e5c }),
  Object.freeze({ code: 4, hex: 0xc91a09 }),
  Object.freeze({ code: 6, hex: 0x583927 }),
  Object.freeze({ code: 14, hex: 0xf2cd37 }),
  Object.freeze({ code: 2, hex: 0x237841 }),
  Object.freeze({ code: 1, hex: 0x0055bf }),
])

const FALLBACK_COLOR: LDrawBrickColor = Object.freeze({ code: 7, hex: 0x9ba19d })

export const getLDrawBrickColor = (colorIndex: number): LDrawBrickColor =>
  LDRAW_BRICK_COLORS[colorIndex] ?? FALLBACK_COLOR
