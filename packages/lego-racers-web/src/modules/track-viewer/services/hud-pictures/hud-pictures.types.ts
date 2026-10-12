import type { HudFonts } from '../../types/hud-fonts/hud-fonts.types.ts'

// What the HUD draws from: its images (as data URLs, by upper case name) and fonts, with replaced pictures in place of the original's.
export type HudPictures = {
  readonly imageUrls: ReadonlyMap<string, string>
  // Picture pixels per original pixel, by the same names (the source rectangles of the HUD are in the original's pixels).
  readonly imageScales: ReadonlyMap<string, number>
  readonly fonts: HudFonts
}
