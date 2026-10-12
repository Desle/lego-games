import type { BitmapFontPainter, PaintableFontImage } from './bitmap-font-painter.types.ts'

const getTintedCanvas = (image: PaintableFontImage, color: number): HTMLCanvasElement | null => {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d')
  if (context === null) return null
  const red = (color >>> 16) & 0xff
  const green = (color >>> 8) & 0xff
  const blue = color & 0xff
  const alpha = (color >>> 24) & 0xff
  const tinted = new Uint8ClampedArray(image.colors.length)
  for (let offset = 0; offset < tinted.length; offset += 4) {
    tinted[offset] = ((image.colors[offset] ?? 0) * red) / 255
    tinted[offset + 1] = ((image.colors[offset + 1] ?? 0) * green) / 255
    tinted[offset + 2] = ((image.colors[offset + 2] ?? 0) * blue) / 255
    tinted[offset + 3] = ((image.colors[offset + 3] ?? 0) * alpha) / 255
  }
  context.putImageData(new ImageData(tinted, image.width, image.height), 0, 0)
  return canvas
}

// The bitmap fonts of the game are grey glyphs with a colour key; the draw colour multiplies them (the HUD's cyan
// countdown, the menus' green and grey buttons). Tinted copies are kept per font and colour.
export const createBitmapFontPainter = (): BitmapFontPainter => {
  const tintedCanvases = new Map<string, HTMLCanvasElement | null>()
  return Object.freeze({
    drawGlyphs: (context, image, glyphs, color) => {
      const key = `${image.name}:${String(image.width)}:${String(color)}`
      if (!tintedCanvases.has(key)) tintedCanvases.set(key, getTintedCanvas(image, color))
      const canvas = tintedCanvases.get(key)
      if (canvas === null || canvas === undefined) return
      for (const glyph of glyphs) {
        const width = glyph.destination.right - glyph.destination.left
        const height = glyph.destination.bottom - glyph.destination.top
        if (glyph.sourceWidth <= 0 || glyph.sourceHeight <= 0 || width <= 0 || height <= 0) continue
        context.drawImage(
          canvas,
          glyph.sourceX * image.sourceScale,
          glyph.sourceY * image.sourceScale,
          glyph.sourceWidth * image.sourceScale,
          glyph.sourceHeight * image.sourceScale,
          glyph.destination.left,
          glyph.destination.top,
          width,
          height
        )
      }
    },
  })
}
