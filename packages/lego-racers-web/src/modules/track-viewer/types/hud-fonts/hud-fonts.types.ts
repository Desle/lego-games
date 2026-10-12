// @check-allow layer-boundaries: a type-only import of the engine's font, which the HUD fonts hold
import type { BitmapFont } from '@lego-games/lego-racers/font-rendering'

export type HudImage = {
  // The archive file the picture comes from; null for a picture made from a texture of the track.
  readonly archivePath: string | null
  readonly name: string
  readonly width: number
  readonly height: number
  // RGBA, rows top to bottom.
  readonly colors: Uint8Array
  // Picture pixels per original pixel (1 for the original's own).
  readonly sourceScale: number
}

// A font of the HUD: its glyph table and its image (RGBA, colour key applied).
export type HudBitmapFont = {
  readonly font: BitmapFont
  readonly image: HudImage
}

// The HUD's fonts by HudFont value (`text`, `digits`).
export type HudFonts = ReadonlyMap<string, HudBitmapFont>
