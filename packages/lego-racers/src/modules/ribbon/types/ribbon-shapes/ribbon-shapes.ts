import type { RibbonColor, RibbonShape } from '../ribbon.types.ts'

// 0x004b1514: the tether's half width (0.6).
const TETHER_HALF_WIDTH = Math.fround(0.6)
// 0x004af58c: half; 0x00444340 raises the middle vertex by half the width.
const HALF = 0.5
// 0x004c1c50: the bytes the grapple's constructor 0x00453cd0 hands to 0x00494820 (end colour).
const TETHER_END_COLOR: RibbonColor = Object.freeze([0x64, 0x3c, 0x0e, 0xff])
// 0x004c1c54: the control colour of a bulge to the positive side.
const TETHER_POSITIVE_CONTROL_COLOR: RibbonColor = Object.freeze([0x8f, 0x5a, 0x1c, 0xff])
// 0x004c1c58: the control colour of the other side.
const TETHER_NEGATIVE_CONTROL_COLOR: RibbonColor = Object.freeze([0x14, 0x14, 0x00, 0xff])
// 0x00444340 (config slot 4): five rings a segment when the rope may bulge.
const RINGS_PER_SEGMENT = 5
// 0x00444340 (config slot 0x1a): the ring counter wraps after 3.
const WRAP_RING_COUNT = 3

// 0x00444340: the grapple's rope (material "tether"), five rings to a segment, three vertices to a ring: (0, w, 0),
// (0, 0, w / 2), (0, -w, 0), their texture coordinates 0, 0.5 and 1 (0x00493c90 reads the config on 0x00444340's stack);
// the ring counter wraps after 3 (config slot 0x1a).
export const TETHER_RIBBON_SHAPE: RibbonShape = Object.freeze({
  ringsPerSegment: RINGS_PER_SEGMENT,
  vertexOffsets: Object.freeze([
    Object.freeze({ x: 0, y: TETHER_HALF_WIDTH, z: 0 }),
    Object.freeze({ x: 0, y: 0, z: Math.fround(TETHER_HALF_WIDTH * HALF) }),
    Object.freeze({ x: 0, y: -TETHER_HALF_WIDTH, z: 0 }),
  ]),
  textureU: Object.freeze([0, HALF, 1]),
  wrapRingCount: WRAP_RING_COUNT,
  isWrapped: true,
  endColor: TETHER_END_COLOR,
  positiveControlColor: TETHER_POSITIVE_CONTROL_COLOR,
  negativeControlColor: TETHER_NEGATIVE_CONTROL_COLOR,
})

// 0x004b1558: the beam's half width (0.85).
const LIGHTNING_HALF_WIDTH = Math.fround(0.85)
// 0x004548f0: the offsets' third component, -0.25 (0xbe800000), at the sides of the ring.
const LIGHTNING_SIDE_HEIGHT = -0.25
// 0x004b1568: the bytes 0x004548f0 hands to 0x00494820 (end colour).
const LIGHTNING_END_COLOR: RibbonColor = Object.freeze([0x19, 0x41, 0xf5, 0xff])
// 0x004b156c: the control colour of a bulge to the positive side.
const LIGHTNING_POSITIVE_CONTROL_COLOR: RibbonColor = Object.freeze([0x19, 0x41, 0xff, 0xff])
// 0x004b1570: the control colour of the other side.
const LIGHTNING_NEGATIVE_CONTROL_COLOR: RibbonColor = Object.freeze([0x19, 0x41, 0xeb, 0xff])

// 0x004548f0: the wand's beam (material "lightng"), five rings to a segment, the ring (0, w, -0.25), (0, 0, w / 2),
// (0, -w, -0.25), its texture coordinates 0, 0.5 and 1; the counter wraps after 3 and the figure faces the camera.
export const LIGHTNING_RIBBON_SHAPE: RibbonShape = Object.freeze({
  ringsPerSegment: RINGS_PER_SEGMENT,
  vertexOffsets: Object.freeze([
    Object.freeze({ x: 0, y: LIGHTNING_HALF_WIDTH, z: LIGHTNING_SIDE_HEIGHT }),
    Object.freeze({ x: 0, y: 0, z: Math.fround(LIGHTNING_HALF_WIDTH * HALF) }),
    Object.freeze({ x: 0, y: -LIGHTNING_HALF_WIDTH, z: LIGHTNING_SIDE_HEIGHT }),
  ]),
  textureU: Object.freeze([0, HALF, 1]),
  wrapRingCount: WRAP_RING_COUNT,
  isWrapped: true,
  endColor: LIGHTNING_END_COLOR,
  positiveControlColor: LIGHTNING_POSITIVE_CONTROL_COLOR,
  negativeControlColor: LIGHTNING_NEGATIVE_CONTROL_COLOR,
})
