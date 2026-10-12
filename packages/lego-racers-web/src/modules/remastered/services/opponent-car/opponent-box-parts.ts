import type { BoxPart } from './opponent-car.types.ts'

// Plain bricks and plates of the LDraw library that fill a car where the game's own catalogue has no piece of the size (it has no
// plate at all): `length` studs along the part's long side, `width` across, `height` in plates (a brick is 3).
export const BOX_PARTS: readonly BoxPart[] = Object.freeze([
  { partNumber: '3001', length: 4, width: 2, height: 3 },
  { partNumber: '2456', length: 6, width: 2, height: 3 },
  { partNumber: '3002', length: 3, width: 2, height: 3 },
  { partNumber: '3003', length: 2, width: 2, height: 3 },
  { partNumber: '3010', length: 4, width: 1, height: 3 },
  { partNumber: '3009', length: 6, width: 1, height: 3 },
  { partNumber: '3622', length: 3, width: 1, height: 3 },
  { partNumber: '3004', length: 2, width: 1, height: 3 },
  { partNumber: '3032', length: 6, width: 4, height: 1 },
  { partNumber: '3031', length: 4, width: 4, height: 1 },
  { partNumber: '3795', length: 6, width: 2, height: 1 },
  { partNumber: '3020', length: 4, width: 2, height: 1 },
  { partNumber: '3021', length: 3, width: 2, height: 1 },
  { partNumber: '3022', length: 2, width: 2, height: 1 },
  { partNumber: '3666', length: 6, width: 1, height: 1 },
  { partNumber: '3710', length: 4, width: 1, height: 1 },
  { partNumber: '3623', length: 3, width: 1, height: 1 },
  { partNumber: '3023', length: 2, width: 1, height: 1 },
])

const BOX_PART_PREFIX = 'ldraw:'

export const getBoxPartName = (part: BoxPart): string => `${BOX_PART_PREFIX}${part.partNumber}`

// The part a design's brick name stands for, or null when the name is a catalogue piece of the game.
export const findBoxPart = (name: string): BoxPart | null =>
  name.startsWith(BOX_PART_PREFIX)
    ? (BOX_PARTS.find((part) => getBoxPartName(part) === name) ?? null)
    : null
