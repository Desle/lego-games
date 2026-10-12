import type { FontDrawCommand } from '@lego-games/lego-racers/font-rendering'

// A font image as the painter draws it: RGBA, rows top to bottom, with the colour key already transparent.
export type PaintableFontImage = {
  readonly name: string
  readonly width: number
  readonly height: number
  readonly colors: Uint8Array
  // Picture pixels per original pixel: the glyph rectangles are in the original's pixels.
  readonly sourceScale: number
}

export type BitmapFontPainter = {
  // Draws the glyph rectangles the font layout produced, each glyph pixel multiplied by `color` (0xAARRGGBB).
  // The caller turns image smoothing off on its context.
  readonly drawGlyphs: (
    context: CanvasRenderingContext2D,
    image: PaintableFontImage,
    glyphs: readonly FontDrawCommand[],
    color: number
  ) => void
}
