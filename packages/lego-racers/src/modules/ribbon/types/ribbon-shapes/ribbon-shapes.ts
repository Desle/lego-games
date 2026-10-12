import type { RibbonColor, RibbonShape } from '../ribbon.types.ts'

// 0x004b1514: the tether's half width (0.6).
const TETHER_HALF_WIDTH = Math.fround(0.6)
// 0x004af58c: half; 0x00444340 raises the middle vertex by half the width.
const HALF = 0.5
// 0x004c1c50, 0x004c1c54, 0x004c1c58: the bytes the grapple's constructor 0x00453cd0 hands to 0x00494820.
const TETHER_END_COLOR: RibbonColor = Object.freeze([0x64, 0x3c, 0x0e, 0xff])
const TETHER_POSITIVE_CONTROL_COLOR: RibbonColor = Object.freeze([0x8f, 0x5a, 0x1c, 0xff])
const TETHER_NEGATIVE_CONTROL_COLOR: RibbonColor = Object.freeze([0x14, 0x14, 0x00, 0xff])

// 0x00444340: the grapple's rope (material "tether"), five rings to a segment, three vertices to a ring: (0, w, 0),
// (0, 0, w / 2), (0, -w, 0), their texture coordinates 0, 0.5 and 1 (0x00493c90 reads the config on 0x00444340's stack);
// the ring counter wraps after 3 (config slot 0x1a).
export const TETHER_RIBBON_SHAPE: RibbonShape = Object.freeze({
  ringsPerSegment: 5,
  vertexOffsets: Object.freeze([
    Object.freeze({ x: 0, y: TETHER_HALF_WIDTH, z: 0 }),
    Object.freeze({ x: 0, y: 0, z: Math.fround(TETHER_HALF_WIDTH * HALF) }),
    Object.freeze({ x: 0, y: -TETHER_HALF_WIDTH, z: 0 }),
  ]),
  textureU: Object.freeze([0, HALF, 1]),
  wrapRingCount: 3,
  isWrapped: true,
  endColor: TETHER_END_COLOR,
  positiveControlColor: TETHER_POSITIVE_CONTROL_COLOR,
  negativeControlColor: TETHER_NEGATIVE_CONTROL_COLOR,
})
