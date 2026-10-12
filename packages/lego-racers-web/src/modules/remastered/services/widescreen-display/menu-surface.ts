// A menu surface bigger than this (in design pixels per design pixel) would outgrow the textures of a graphics card.
const MAXIMUM_MENU_SURFACE_SCALE = 8
const SCALE_STEP = 0.25

// The menus' surface at the display's native resolution: one surface pixel per device pixel, in steps so that a
// window resized by a few pixels does not rebuild it, and never below the design's own resolution.
export const getNativeMenuSurfaceScale = (devicePixelsPerDesignPixel: number): number => {
  if (!Number.isFinite(devicePixelsPerDesignPixel)) return 1
  const stepped = Math.ceil(devicePixelsPerDesignPixel / SCALE_STEP) * SCALE_STEP
  return Math.min(Math.max(stepped, 1), MAXIMUM_MENU_SURFACE_SCALE)
}
