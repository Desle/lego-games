import type { SaveRacer } from '../../../save-data/index.ts'

// 0x0042b330: the five bytes handed to the figure builder: record bytes +0x1d, +0x1c, +0x1f and +0x1e, then +0x20 without
// its top bit; in the order of the builder's reads: the hat, the face, the torso, the legs and the expression.
export const getDriverPartBytes = (racer: SaveRacer): readonly number[] => {
  const [first = 0, second = 0, third = 0, fourth = 0, fifth = 0] = racer.colorBytes
  return Object.freeze([second, first, fourth, third, fifth & 0x7f])
}
