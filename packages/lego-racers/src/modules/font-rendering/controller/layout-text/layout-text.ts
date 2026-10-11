import { getTruncatedInteger } from '../../../simulation-math/index.ts'
import type { FontDrawCommand, TextLayoutParameters } from '../../types/font-rendering.types.ts'
import { getGlyphIndex } from '../get-glyph-index/get-glyph-index.ts'
import { getTextLine } from '../measure-text/get-text-line.ts'
import { drawGlyphRun } from './draw-glyph-run.ts'

// The original copies at most this many glyph indices (DAT_004c2860) into the run it draws at once.
const GLYPH_RUN_CAPACITY = 0x80

// LEGORacers.exe 0x00408fe0: breaks a string into lines of at most `maximumWidth / scale.x` pixels, draws each line's
// glyphs from `x`, and moves down by ceil((lineHeight + lineGap) * scale.y) per line. A centred line starts
// (width - lineWidth) / 2 further right, measured in unscaled pixels as the original does.
export const layoutText = (parameters: TextLayoutParameters): readonly FontDrawCommand[] => {
  const { font, text, surface, x, maximumWidth, lineGap, scale, clip, alignment, arithmetic } =
    parameters
  const commands: FontDrawCommand[] = []
  if (text.length === 0) return commands
  const availableWidth = getTruncatedInteger(Math.floor(arithmetic.divide(maximumWidth, scale.x)))
  const lineAdvance = getTruncatedInteger(
    Math.ceil(arithmetic.multiply(font.lineHeight + lineGap, scale.y))
  )
  let y = parameters.y
  let position = 0
  let isLineStart = true
  while (position < text.length) {
    const line = getTextLine(font, text, position, isLineStart, availableWidth)
    let lineX = x
    if (alignment === 'center' && line.width >>> 0 < availableWidth >>> 0) {
      lineX = ((availableWidth - line.width) >>> 1) + x
    }
    for (let runStart = line.start; runStart < line.end; runStart += GLYPH_RUN_CAPACITY) {
      const runEnd = Math.min(line.end, runStart + GLYPH_RUN_CAPACITY)
      const glyphIndices = text.slice(runStart, runEnd).map((code) => getGlyphIndex(font, code))
      const run = drawGlyphRun({
        font,
        glyphIndices,
        surface,
        x: lineX,
        y,
        scale,
        clip,
        arithmetic,
      })
      commands.push(...run.commands)
      lineX = run.nextX
    }
    y += lineAdvance
    position = line.nextPosition
    isLineStart = line.isNextLineStart
  }
  return commands
}
