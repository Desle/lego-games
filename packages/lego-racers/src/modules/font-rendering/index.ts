export { buildBitmapFont } from './controller/build-bitmap-font/build-bitmap-font.ts'
export { getFontImagePixels } from './controller/get-font-image-pixels/get-font-image-pixels.ts'
export { getGlyphIndex } from './controller/get-glyph-index/get-glyph-index.ts'
export { layoutText } from './controller/layout-text/layout-text.ts'
export { drawGlyphRun } from './controller/layout-text/draw-glyph-run.ts'
export { clipGlyphRectangles, getClipRectangle } from './controller/clip-text/clip-text.ts'
export { getTextLine } from './controller/measure-text/get-text-line.ts'
export { getCharacterAdvance, getTextWidth } from './controller/measure-text/get-text-width.ts'
export { getWrappedTextSize } from './controller/measure-text/get-wrapped-text-size.ts'
export {
  IncompleteFontImageError,
  MissingFontCharactersError,
} from './types/font-rendering-errors/font-rendering-errors.ts'
export type {
  BitmapFont,
  FontColorKey,
  FontDrawCommand,
  FontGlyph,
  TextAlignment,
  TextLayoutParameters,
  TextLine,
  TextMeasureParameters,
  TextRectangle,
  TextScale,
  TextSize,
  TextSurface,
} from './types/font-rendering.types.ts'
