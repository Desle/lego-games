/* eslint-disable no-param-reassign -- the canvas context is drawn on by setting its state */
import { createFloatArithmetic, RACE_FPU_PRECISION } from '@lego-games/lego-racers/simulation-math'
import { layoutText } from '@lego-games/lego-racers/font-rendering'
import { paintHudPolygon } from './hud-polygon.ts'
import type { HudPaintInput } from './hud-painter.types.ts'

// 0xAARRGGBB; null is the font's own white.
const WHITE = 0xffffffff
// The text has no line break width in the HUD: the layout never wraps.
const UNBOUNDED_WIDTH = 0x7fff
const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)

const getCssColor = (color: number) =>
  `rgba(${String((color >>> 16) & 0xff)}, ${String((color >>> 8) & 0xff)}, ${String(color & 0xff)}, ${String(((color >>> 24) & 0xff) / 255)})`

// The race HUD as the HUD module laid it out: the text set in the game's bitmap fonts (glyph rectangles from the
// engine's font layout), the image parts, the triangles and the fills, on a canvas the size of the stage.
export const paintHud = (context: CanvasRenderingContext2D, input: HudPaintInput): void => {
  const { commands, fonts, loadedImages, painter, width, height } = input
  context.clearRect(0, 0, width, height)
  context.imageSmoothingQuality = 'high'
  context.imageSmoothingEnabled = false
  for (const command of commands) {
    if (command.kind === 'fill') {
      context.fillStyle = getCssColor(command.color)
      context.fillRect(command.x, command.y, command.width, command.height)
      continue
    }
    if (command.kind === 'image_part') {
      const image = loadedImages.get(command.imageName.toUpperCase())
      if (image === undefined || !image.complete) continue
      const [sourceLeft, sourceTop, sourceRight, sourceBottom] = command.source
      const scale = input.imageScales.get(command.imageName.toUpperCase()) ?? 1
      context.imageSmoothingEnabled = scale > 1
      context.drawImage(
        image,
        sourceLeft * scale,
        sourceTop * scale,
        (sourceRight - sourceLeft) * scale,
        (sourceBottom - sourceTop) * scale,
        command.x,
        command.y,
        command.width,
        command.height
      )
      continue
    }
    if (command.kind === 'polygon') {
      paintHudPolygon(
        context,
        command,
        command.imageName === null ? null : (loadedImages.get(command.imageName) ?? null)
      )
      continue
    }
    if (command.kind === 'image') {
      const image = loadedImages.get(command.imageName.toUpperCase())
      if (!input.isImagePainted || image === undefined || !image.complete) continue
      context.imageSmoothingEnabled = true
      context.drawImage(image, command.x, command.y, command.width, command.height)
      context.imageSmoothingEnabled = false
      continue
    }
    const hudFont = fonts.get(command.font)
    if (hudFont === undefined) continue
    const glyphs = layoutText({
      font: hudFont.font,
      text: Array.from(command.text, (letter) => letter.charCodeAt(0)),
      surface: { width, height },
      x: command.x,
      y: command.y,
      maximumWidth: UNBOUNDED_WIDTH,
      lineGap: 0,
      scale: { x: command.scaleX, y: command.scaleY },
      clip: null,
      alignment: 'left',
      arithmetic,
    })
    context.imageSmoothingEnabled = hudFont.image.sourceScale > 1
    painter.drawGlyphs(context, hudFont.image, glyphs, command.color ?? WHITE)
  }
}
