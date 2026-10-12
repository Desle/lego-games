const DESKTOP_MAXIMUM_SIZE = 4096
const SMALL_SCREEN_MAXIMUM_SIZE = 2048
const SMALL_SCREEN_SHORT_SIDE = 900

// The longer side of the baked scenery map in texels: 4096 (about 80 MB of depth and colour) on a desktop, 2048 (about 20 MB)
// on a phone or tablet, never beyond what the graphics card allows.
export const getBakedShadowSize = (maximumTextureSize: number, shortScreenSide: number): number => {
  const isSmallScreen = shortScreenSide < SMALL_SCREEN_SHORT_SIDE
  const wanted = isSmallScreen ? SMALL_SCREEN_MAXIMUM_SIZE : DESKTOP_MAXIMUM_SIZE
  return Math.min(wanted, maximumTextureSize)
}
