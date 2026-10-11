import type { BitmapFont, TextLine } from '../../types/font-rendering.types.ts'
import { getCharacterAdvance } from './get-text-width.ts'

const SPACE_CODE = 0x20
const LINE_FEED = 0x0a
const CARRIAGE_RETURN = 0x0d

// 0x00449e50 hands out a pointer into the string; reading the terminator gives 0.
const getCode = (text: readonly number[], index: number): number => text[index] ?? 0

const getIsAbove = (value: number, limit: number): boolean => value >>> 0 > limit >>> 0

// The line breaking that LEGORacers.exe 0x00408d50 (measure) and 0x00408fe0 (draw) share, statement for statement:
// words break at the last space; a word wider than the line breaks between letters.
export const getTextLine = (
  font: BitmapFont,
  text: readonly number[],
  position: number,
  isLineStart: boolean,
  availableWidth: number
): TextLine => {
  let start = position
  if (!isLineStart) {
    while (getCode(text, start) === SPACE_CODE) start += 1
  }
  let end = start
  let breakPosition = start
  let wordWidth = 0
  let lineWidth = 0
  let isWithinLine = true
  while (isWithinLine) {
    const code = getCode(text, end)
    if (end >= text.length || code === LINE_FEED || code === CARRIAGE_RETURN) break
    if (code === SPACE_CODE && wordWidth !== 0 && getCode(text, end - 1) !== SPACE_CODE) {
      wordWidth = 0
      breakPosition = end
    }
    const advance = getCharacterAdvance(font, code)
    wordWidth += advance
    lineWidth += advance
    end += 1
    isWithinLine = !getIsAbove(lineWidth, availableWidth)
  }
  if (getIsAbove(lineWidth, availableWidth)) {
    if (wordWidth === lineWidth) {
      const minimumEnd = breakPosition + 1
      while (getIsAbove(lineWidth, availableWidth) && end > minimumEnd) {
        end -= 1
        lineWidth -= getCharacterAdvance(font, getCode(text, end))
      }
    } else {
      end = breakPosition
      lineWidth -= wordWidth
    }
  }
  let nextPosition = end
  const first = getCode(text, nextPosition)
  if (first === CARRIAGE_RETURN) nextPosition += 1
  const second = getCode(text, nextPosition)
  if (second === LINE_FEED) nextPosition += 1
  return Object.freeze({
    start,
    end,
    width: lineWidth,
    nextPosition,
    isNextLineStart: second === LINE_FEED || first === CARRIAGE_RETURN,
  })
}
