import type { LDrawHat } from './ldraw-minifig-hats.types.ts'

const getHat = (part: string, colorCode: number): LDrawHat => Object.freeze({ part, colorCode })

const BLACK = 0
const BLUE = 1
const GREEN = 2
const RED = 4
const BROWN = 6
const LIGHT_GRAY = 7
const YELLOW = 14
const WHITE = 15

// The hats of `BODYPART.PCB` by catalogue index (its `0x29` list: nohat, helmtrr, helmet2s, bb_hats ...) and the library's part
// that stands for each, in the colour the game paints it. The library has no part for the more exotic ones (the red feathered
// helmet, the tribal headdress): the nearest headwear stands in. Hair parts share the head's origin, as every headwear part does.
export const LDRAW_HATS: readonly (LDrawHat | null)[] = Object.freeze([
  null,
  getHat('3842a', BLACK),
  getHat('89520', BLACK),
  getHat('30105', BLACK),
  getHat('2528a', BLACK),
  getHat('2544', BLACK),
  getHat('61506', BROWN),
  getHat('30276', RED),
  getHat('3878', BLACK),
  getHat('12894', WHITE),
  getHat('30138', RED),
  getHat('30171b', BLACK),
  getHat('30090b', WHITE),
  getHat('3629', WHITE),
  getHat('71016', BLACK),
  getHat('2631', LIGHT_GRAY),
  getHat('2631', BROWN),
  getHat('2631', BLACK),
  getHat('6131', BLACK),
  getHat('44553', BLACK),
  getHat('3901', BLACK),
  getHat('3901', LIGHT_GRAY),
  getHat('3901', BROWN),
  getHat('2631', YELLOW),
  getHat('12890', BLACK),
  getHat('4503', BLACK),
  getHat('30168b', YELLOW),
  getHat('2544', BLACK),
  getHat('3842a', BLUE),
  getHat('3842a', RED),
  getHat('3842a', WHITE),
  getHat('90541', GREEN),
  getHat('86035', BLUE),
  getHat('6131', BLUE),
  getHat('4506c01', GREEN),
  getHat('3842a', LIGHT_GRAY),
])
