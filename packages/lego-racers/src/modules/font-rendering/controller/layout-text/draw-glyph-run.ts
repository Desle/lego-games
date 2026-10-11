import { getFloatFromBits, getTruncatedInteger } from '../../../simulation-math/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import { clipGlyphRectangles, getClipRectangle } from '../clip-text/clip-text.ts'
import type {
  BitmapFont,
  FontDrawCommand,
  TextRectangle,
  TextScale,
  TextSurface,
} from '../../types/font-rendering.types.ts'

// The float at 0x004af300: a scale at or below it draws nothing.
const MINIMUM_SCALE = getFloatFromBits(0x30800000)
const ONE = 1

export type GlyphRunParameters = {
  readonly font: BitmapFont
  readonly glyphIndices: readonly number[]
  readonly surface: TextSurface
  readonly x: number
  readonly y: number
  readonly scale: TextScale
  readonly clip: TextRectangle | null
  readonly arithmetic: FloatArithmetic
}

export type GlyphRun = {
  readonly commands: readonly FontDrawCommand[]
  // What 0x00409300 returns: the x where the next glyph would start.
  readonly nextX: number
}

// LEGORacers.exe 0x00409300: places a run of glyphs left to right. Each advance is the glyph width times the scale
// (truncated for the rectangle, kept as a float for the position) plus the scaled letter spacing.
// The original draws page by page; every font fits one page, so the draw order is the text order.
export const drawGlyphRun = (parameters: GlyphRunParameters): GlyphRun => {
  const { font, glyphIndices, surface, y, scale, clip, arithmetic } = parameters
  const { x } = parameters
  if (scale.x <= MINIMUM_SCALE || scale.y <= MINIMUM_SCALE) return { commands: [], nextX: x }
  const bounds = getClipRectangle(surface, clip)
  if (bounds === null || x > bounds.right || y > bounds.bottom) return { commands: [], nextX: x }
  const bottom = getTruncatedInteger(arithmetic.multiply(font.lineHeight, scale.y)) + y
  if (bottom < bounds.top) return { commands: [], nextX: x }
  const spacing = arithmetic.storeFloat(arithmetic.multiply(font.letterSpacing, scale.x))
  const inverseScale = {
    x: arithmetic.storeFloat(arithmetic.divide(ONE, scale.x)),
    y: arithmetic.storeFloat(arithmetic.divide(ONE, scale.y)),
  }
  const commands: FontDrawCommand[] = []
  let floatX = arithmetic.storeFloat(x)
  let currentX = x
  for (const glyphIndex of glyphIndices) {
    if (currentX >= bounds.right) break
    const glyph = font.glyphs[glyphIndex]
    if (glyph === undefined) continue
    const scaledWidth = arithmetic.multiply(glyph.width, scale.x)
    const right = getTruncatedInteger(scaledWidth) + currentX
    const nextExactX = arithmetic.add(arithmetic.add(scaledWidth, floatX), spacing)
    floatX = arithmetic.storeFloat(nextExactX)
    const glyphX = currentX
    currentX = getTruncatedInteger(nextExactX)
    if (right < bounds.left) continue
    const clipped = clipGlyphRectangles(
      bounds,
      { left: 0, top: 0, right: glyph.width, bottom: font.lineHeight },
      { left: glyphX, top: y, right, bottom },
      inverseScale,
      arithmetic
    )
    commands.push(
      Object.freeze({
        code: glyph.code,
        sourceX: glyph.imageX + clipped.source.left,
        sourceY: clipped.source.top,
        sourceWidth: clipped.source.right - clipped.source.left,
        sourceHeight: clipped.source.bottom - clipped.source.top,
        destination: clipped.destination,
      })
    )
  }
  return { commands, nextX: currentX }
}
