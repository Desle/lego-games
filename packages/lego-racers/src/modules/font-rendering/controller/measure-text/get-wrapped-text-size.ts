import { getTruncatedInteger } from '../../../simulation-math/index.ts'
import type { TextMeasureParameters, TextSize } from '../../types/font-rendering.types.ts'
import { getTextLine } from './get-text-line.ts'

// LEGORacers.exe 0x00408d50: the size of a string broken into lines of at most `maximumWidth` pixels at a scale.
// The height of the first line starts at ceil(-offset * scaleY) for a negative offset; every line adds
// ceil((lineHeight + offset) * scaleY). The width is the widest line (without its last letter spacing) scaled and rounded up.
export const getWrappedTextSize = (parameters: TextMeasureParameters): TextSize => {
  const { font, text, maximumWidth, firstLineOffset, scale, arithmetic } = parameters
  if (text.length === 0) return Object.freeze({ width: 0, height: 0 })
  let height = 0
  if (firstLineOffset < 0) {
    height = getTruncatedInteger(Math.ceil(arithmetic.multiply(-firstLineOffset, scale.y)))
  }
  const availableWidth = getTruncatedInteger(Math.floor(arithmetic.divide(maximumWidth, scale.x)))
  const lineAdvance = getTruncatedInteger(
    Math.ceil(arithmetic.multiply(font.lineHeight + firstLineOffset, scale.y))
  )
  height += lineAdvance
  let width = 0
  let position = 0
  let isLineStart = true
  while (position < text.length) {
    const line = getTextLine(font, text, position, isLineStart, availableWidth)
    const lineWidth = line.width - font.letterSpacing
    if (width >>> 0 < lineWidth >>> 0) width = lineWidth
    position = line.nextPosition
    isLineStart = line.isNextLineStart
    if (position >= text.length) break
    height += lineAdvance
  }
  if (font.letterSpacing < 0) width -= font.letterSpacing
  // The result is stored into an unsigned output, so a negative width reads as a large number.
  width = getTruncatedInteger(Math.ceil(arithmetic.multiply(width, scale.x))) >>> 0
  return Object.freeze({ width, height })
}
