import type { HudPolygonCommand, HudVertex } from '@lego-games/lego-racers/race-hud'
import type { TextureTransform } from './hud-polygon.types.ts'

// The affine map from an image's pixels to the screen that carries the polygon's texture coordinates onto its corners.
// A coordinate v = 0 is the picture's bottom edge (the engine's surface starts with the last row), so the pixel row is
// (1 - v) times the height. Null for a degenerate triangle.
export const getTextureTransform = (
  vertices: HudPolygonCommand['vertices'],
  imageWidth: number,
  imageHeight: number
): TextureTransform | null => {
  const [first, second, third] = vertices
  const getPixel = (vertex: HudVertex) => ({
    x: vertex.u * imageWidth,
    y: (1 - vertex.v) * imageHeight,
  })
  const [pixelFirst, pixelSecond, pixelThird] = [getPixel(first), getPixel(second), getPixel(third)]
  const determinant =
    (pixelSecond.x - pixelFirst.x) * (pixelThird.y - pixelFirst.y) -
    (pixelThird.x - pixelFirst.x) * (pixelSecond.y - pixelFirst.y)
  if (Math.abs(determinant) < 1e-9) return null
  const solve = (firstValue: number, secondValue: number, thirdValue: number) => {
    const horizontal =
      ((secondValue - firstValue) * (pixelThird.y - pixelFirst.y) -
        (thirdValue - firstValue) * (pixelSecond.y - pixelFirst.y)) /
      determinant
    const vertical =
      ((thirdValue - firstValue) * (pixelSecond.x - pixelFirst.x) -
        (secondValue - firstValue) * (pixelThird.x - pixelFirst.x)) /
      determinant
    return {
      horizontal,
      vertical,
      offset: firstValue - horizontal * pixelFirst.x - vertical * pixelFirst.y,
    }
  }
  const x = solve(first.x, second.x, third.x)
  const y = solve(first.y, second.y, third.y)
  return {
    xFromX: x.horizontal + 0,
    yFromX: y.horizontal + 0,
    xFromY: x.vertical + 0,
    yFromY: y.vertical + 0,
    xOffset: x.offset + 0,
    yOffset: y.offset + 0,
  }
}

// Draws the polygon on a canvas: textured with the image (its alpha scaled by the vertices' alpha) or filled with the
// first vertex's colour.
export const paintHudPolygon = (
  context: CanvasRenderingContext2D,
  command: HudPolygonCommand,
  image: HTMLImageElement | null
): void => {
  const [first, second, third] = command.vertices
  context.save()
  context.beginPath()
  context.moveTo(first.x, first.y)
  context.lineTo(second.x, second.y)
  context.lineTo(third.x, third.y)
  context.closePath()
  if (command.imageName === null) {
    const color = first.color
    // eslint-disable-next-line no-param-reassign -- the canvas context is drawn on by setting its state
    context.fillStyle = `rgba(${String((color >>> 16) & 0xff)}, ${String((color >>> 8) & 0xff)}, ${String(color & 0xff)}, ${String(((color >>> 24) & 0xff) / 255)})`
    context.fill()
  } else if (image !== null && image.complete && image.naturalWidth > 0) {
    const transform = getTextureTransform(command.vertices, image.naturalWidth, image.naturalHeight)
    if (transform !== null) {
      context.clip()
      // eslint-disable-next-line no-param-reassign -- the canvas context is drawn on by setting its state
      context.globalAlpha = ((first.color >>> 24) & 0xff) / 255
      context.transform(
        transform.xFromX,
        transform.yFromX,
        transform.xFromY,
        transform.yFromY,
        transform.xOffset,
        transform.yOffset
      )
      context.drawImage(image, 0, 0)
    }
  }
  context.restore()
}
