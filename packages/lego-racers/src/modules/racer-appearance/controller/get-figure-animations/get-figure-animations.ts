import { parseAnimation } from '../../../animation/index.ts'
import type { AnimationKeyword2cEntry } from '../../../animation/index.ts'
import type { FigureAnimation } from '../../../racer/index.ts'

const UNSIGNED_SHORT_MASK = 0xffff

// One 40-byte entry of the ADB's keyword 0x2c is one record of the figure's animation set (figure +0xa8 -> +0x2c):
// the rate at +0, the vector at +4, the bounding sphere at +0x10 (keyword 0x31's four values), the frame count at +0x24
// and the period at +0x26 (0x0040dae0, 0x0040e0b0).
const getFigureAnimation = (entry: AnimationKeyword2cEntry): FigureAnimation => {
  const [vectorX, vectorY, vectorZ] = entry.keyword30Values
  const [centreX, centreY, centreZ, radius] = entry.keyword31Values
  return Object.freeze({
    rate: entry.keyword2fValue,
    vector: Object.freeze({ x: vectorX, y: vectorY, z: vectorZ }),
    boundsCentre: Object.freeze({ x: centreX, y: centreY, z: centreZ }),
    boundsRadius: radius,
    frameCount: entry.keyword2dValue & UNSIGNED_SHORT_MASK,
    period: entry.keyword2eValue & UNSIGNED_SHORT_MASK,
  })
}

export const getFigureAnimations = (animationBytes: Uint8Array): readonly FigureAnimation[] =>
  parseAnimation(animationBytes).keyword2cEntries.map(getFigureAnimation)
