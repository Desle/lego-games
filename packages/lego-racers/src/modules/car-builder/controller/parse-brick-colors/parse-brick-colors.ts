import { createTokenReader } from '../../../token-reader/index.ts'
import type { BrickColor } from '../../types/car-builder.types.ts'

const COLOR_NAMES_KEYWORD = 0x2d
// 0x00497830 keeps ten characters of a colour's name.
export const COLOR_NAME_LENGTH = 10

// LegoColors_Load 0x00497a10: `0x2d [ count ] { name × count }`. The index a colour keeps is its position in the file,
// which a design stores (the loader sorts by name for its lookups, 0x00497d80).
export const parseBrickColors = (bytes: Uint8Array): readonly BrickColor[] => {
  const reader = createTokenReader(bytes)
  reader.expectToken(COLOR_NAMES_KEYWORD)
  const count = reader.readArrayCount()
  const colors = Array.from({ length: count }, (_, index): BrickColor =>
    Object.freeze({ name: reader.readString().slice(0, COLOR_NAME_LENGTH), index })
  )
  reader.expectRightCurly()
  return Object.freeze(colors)
}

// 0x00497d80: the index of the colour with a name (ten characters compared), or -1.
export const findBrickColorIndex = (colors: readonly BrickColor[], name: string): number =>
  colors.find(
    (color) => color.name.slice(0, COLOR_NAME_LENGTH) === name.slice(0, COLOR_NAME_LENGTH)
  )?.index ?? -1

// The material length the colour lookup compares (0x00497980 strncmp over eight characters).
const MATERIAL_NAME_LENGTH = 8

// 0x00497980: for each colour (by index) the first material of the brick material library whose name is the colour's
// (eight characters compared), or -1.
export const getBrickColorMaterialIndices = (
  colors: readonly BrickColor[],
  materialNames: readonly string[]
): readonly number[] =>
  Object.freeze(
    colors.map((color) =>
      materialNames.findIndex(
        (name) => name.slice(0, MATERIAL_NAME_LENGTH) === color.name.slice(0, MATERIAL_NAME_LENGTH)
      )
    )
  )
