const MOSTLY_FRAME =
  'Hand work needed: the model is a thin open chassis frame with a few bricks, so most of it stays the game mesh.'

// What each rebuilt car is like against the game's model, from the gallery sheets (`~/ldraw-gallery/opponents/`).
export const OPPONENT_CAR_NOTES: Readonly<Record<string, string>> = Object.freeze({
  VVCM: 'Good: the nose, the cockpit block and the tail wedge are bricks and slopes; the front panel keeps its printed decal.',
  RRCM: 'Good: the largest rebuild (16 bricks, plates and slopes) with the printed nose logo; the side pods stay the game mesh.',
  BKCM: `${MOSTLY_FRAME} Two bricks (windscreen slope, tall block); shield and wheel decals kept.`,
  RKCM: `${MOSTLY_FRAME} Same two-brick shape as the other knights' cars.`,
  RHCM: `${MOSTLY_FRAME} One slope and one block.`,
  CCCM: `${MOSTLY_FRAME} A few blue bricks and the white windscreen slope.`,
  ACM: 'Fair: the bricks of the cockpit and sides are right in size and colour; the chassis frame stays the game mesh.',
  PHCM: `${MOSTLY_FRAME} The tan walls stay the game mesh.`,
  GBCM: 'Fair: as the pirate car (same body shape), bricks in red and yellow, frame stays the game mesh.',
  BHCM: 'Fair: red and blue bricks and slopes; the parrot is part of the game mesh.',
  SSCM: 'Fair: grey and black bricks over a white chassis frame that stays the game mesh.',
  TCCM: 'Fair: yellow walls and the red slope are bricks; the frame stays the game mesh.',
  NHCM: `${MOSTLY_FRAME} Three bricks only.`,
  APCM: `${MOSTLY_FRAME} Only one brick; the model's studs and plates are game mesh.`,
  KKCM: 'Good: the yellow canopy and the grey throne are bricks; the red and yellow floor frame and the spears stay the game mesh.',
  CRCM: `${MOSTLY_FRAME} Thin slab with three bricks.`,
  BVBCM:
    'Good: a solid hull, six bricks and slopes cover 37 % of the surface and nearly every filled cell.',
  JTCM: 'Fair: nine bricks and slopes on the body; some stand a little proud of the model (extra cells).',
  BBCM: 'Fair: five bricks, the rest of the thin body stays the game mesh.',
  GMCM: 'Good: the second largest rebuild (15 bricks); the wing frame stays the game mesh.',
})
