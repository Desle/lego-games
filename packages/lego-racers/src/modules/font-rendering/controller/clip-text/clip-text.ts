import { getTruncatedInteger } from '../../../simulation-math/index.ts'
import type { FloatArithmetic } from '../../../simulation-math/index.ts'
import type {
  ClippedGlyphRectangles,
  InverseScale,
  TextRectangle,
  TextSurface,
} from '../../types/font-rendering.types.ts'

// LEGORacers.exe 0x00409560: the part of the surface a clip rectangle leaves; null (no clip) is the whole surface.
// A clip that is empty or lies outside the surface leaves nothing.
export const getClipRectangle = (
  surface: TextSurface,
  clip: TextRectangle | null
): TextRectangle | null => {
  if (clip === null) {
    return Object.freeze({ left: 0, top: 0, right: surface.width, bottom: surface.height })
  }
  if (clip.right < 1 || surface.width <= clip.left) return null
  if (clip.bottom < 1 || surface.height <= clip.top) return null
  return Object.freeze({
    left: clip.left < 0 ? 0 : clip.left,
    top: clip.top < 0 ? 0 : clip.top,
    right: Math.min(clip.right, surface.width),
    bottom: Math.min(clip.bottom, surface.height),
  })
}

// LEGORacers.exe 0x00409690: moves each edge of the destination inside the clip rectangle and the matching edge
// of the source by the same distance divided by the scale (truncated).
export const clipGlyphRectangles = (
  clip: TextRectangle,
  source: TextRectangle,
  destination: TextRectangle,
  inverseScale: InverseScale,
  arithmetic: FloatArithmetic
): ClippedGlyphRectangles => {
  const getScaledDistance = (distance: number, factor: number): number =>
    getTruncatedInteger(arithmetic.multiply(distance, factor))
  let { left: sourceLeft, top: sourceTop, right: sourceRight, bottom: sourceBottom } = source
  let { left, top, right, bottom } = destination
  if (clip.bottom < bottom) {
    const distance = bottom - clip.bottom
    bottom -= distance
    sourceBottom -= getScaledDistance(distance, inverseScale.y)
  }
  if (clip.top > top) {
    const distance = clip.top - top
    top += distance
    sourceTop += getScaledDistance(distance, inverseScale.y)
  }
  if (clip.right < right) {
    const distance = right - clip.right
    right -= distance
    sourceRight -= getScaledDistance(distance, inverseScale.x)
  }
  if (clip.left > left) {
    const distance = clip.left - left
    left += distance
    sourceLeft += getScaledDistance(distance, inverseScale.x)
  }
  return Object.freeze({
    source: Object.freeze({
      left: sourceLeft,
      top: sourceTop,
      right: sourceRight,
      bottom: sourceBottom,
    }),
    destination: Object.freeze({ left, top, right, bottom }),
  })
}
