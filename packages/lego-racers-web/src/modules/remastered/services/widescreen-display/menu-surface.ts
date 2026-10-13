import { RENDER_PIXEL_BUDGET } from './widescreen-display.ts'

const SCALE_STEP = 0.25
const MENU_DESIGN_PIXELS = 640 * 480
// The menu surface stays within the race's pixel budget (about 3.25 times the 640 x 480 design).
const MAXIMUM_MENU_SURFACE_SCALE =
  Math.floor(Math.sqrt(RENDER_PIXEL_BUDGET / MENU_DESIGN_PIXELS) / SCALE_STEP) * SCALE_STEP

// The menus' surface at the display's native resolution: one surface pixel per device pixel, in steps so that a
// window resized by a few pixels does not rebuild it, and never below the design's own resolution.
export const getNativeMenuSurfaceScale = (devicePixelsPerDesignPixel: number): number => {
  if (!Number.isFinite(devicePixelsPerDesignPixel)) return 1
  const stepped = Math.ceil(devicePixelsPerDesignPixel / SCALE_STEP) * SCALE_STEP
  return Math.min(Math.max(stepped, 1), MAXIMUM_MENU_SURFACE_SCALE)
}
