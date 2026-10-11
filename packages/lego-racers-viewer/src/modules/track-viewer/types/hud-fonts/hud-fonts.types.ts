// @check-allow layer-boundaries: a type-only import of the engine's font, which the HUD fonts hold
import type { BitmapFont } from '@lego-games/lego-racers/font-rendering'

export type HudImage = {
  readonly name: string
  readonly width: number
  readonly height: number
  // RGBA, rows top to bottom.
  readonly colors: Uint8Array
}

// A font of the HUD: its glyph table and its image (RGBA, colour key applied).
export type HudBitmapFont = {
  readonly font: BitmapFont
  readonly image: HudImage
}

// The HUD's fonts by HudFont value (`text`, `digits`).
export type HudFonts = ReadonlyMap<string, HudBitmapFont>
