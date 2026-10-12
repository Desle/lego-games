import type {
  FrontEndDrawCommand,
  FrontEndFillCommand,
  FrontEndImage,
  FrontEndResources,
} from '@lego-games/lego-racers/front-end'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { createMenuViewport } from '../../services/menu-viewport/menu-viewport.ts'
import { createBitmapFontPainter } from '../bitmap-font-painter/bitmap-font-painter.ts'
import type { FrontEndRenderer } from './front-end-renderer.types.ts'

const getCssColor = (color: number): string =>
  `rgba(${String((color >>> 16) & 0xff)}, ${String((color >>> 8) & 0xff)}, ${String(color & 0xff)}, ${String(((color >>> 24) & 0xff) / 255)})`

const getImageCanvas = (image: FrontEndImage): HTMLCanvasElement | null => {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d')
  if (context === null) return null
  context.putImageData(
    new ImageData(new Uint8ClampedArray(image.colors), image.width, image.height),
    0,
    0
  )
  return canvas
}

const getFillStyle = (
  context: CanvasRenderingContext2D,
  command: FrontEndFillCommand
): string | CanvasGradient => {
  if (command.color === command.bottomColor) return getCssColor(command.color)
  const gradient = context.createLinearGradient(
    0,
    command.rectangle.top,
    0,
    command.rectangle.bottom
  )
  gradient.addColorStop(0, getCssColor(command.color))
  gradient.addColorStop(1, getCssColor(command.bottomColor))
  return gradient
}

// Draws the front end's commands on a 2D canvas: the menu images (decoded once), fills, and the text set in the
// game's bitmap fonts from the engine's glyph rectangles. A 3D viewport command is a dark panel with the name of
// the object it would show (the menus' 3D backdrops are not rendered yet).
export const createFrontEndRenderer = (
  canvas: HTMLCanvasElement,
  resources: FrontEndResources,
  archive: JamArchive
): FrontEndRenderer => {
  const menuViewport = createMenuViewport(archive)
  let lastTime: number | null = null
  const imageCanvases = new Map<string, HTMLCanvasElement | null>()
  const painter = createBitmapFontPainter()
  const getCachedImageCanvas = (name: string): HTMLCanvasElement | null => {
    if (!imageCanvases.has(name)) {
      const image = resources.getImage(name)
      imageCanvases.set(name, image === null ? null : getImageCanvas(image))
    }
    return imageCanvases.get(name) ?? null
  }
  const tintedCanvases = new Map<string, HTMLCanvasElement | null>()
  // The image's pixels multiplied by a colour (the alpha stays the image's), as the device modulates a textured quad.
  const getTintedImageCanvas = (name: string, tint: number): HTMLCanvasElement | null => {
    const key = `${name}/${String(tint)}`
    if (!tintedCanvases.has(key)) {
      const source = getCachedImageCanvas(name)
      const tinted = source === null ? null : document.createElement('canvas')
      const context = tinted?.getContext('2d')
      if (source !== null && tinted !== null && context !== null && context !== undefined) {
        tinted.width = source.width
        tinted.height = source.height
        context.drawImage(source, 0, 0)
        context.globalCompositeOperation = 'multiply'
        // The frame draws have alpha blending off, so the colour's alpha byte does not show.
        context.fillStyle = getCssColor(tint | 0xff000000)
        context.fillRect(0, 0, tinted.width, tinted.height)
        context.globalCompositeOperation = 'destination-in'
        context.drawImage(source, 0, 0)
      }
      tintedCanvases.set(key, tinted)
    }
    return tintedCanvases.get(key) ?? null
  }
  return Object.freeze({
    draw: (commands: readonly FrontEndDrawCommand[]) => {
      const context = canvas.getContext('2d')
      if (context === null) return
      const now = performance.now()
      const deltaMilliseconds = lastTime === null ? 0 : Math.min(100, Math.floor(now - lastTime))
      lastTime = now
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.imageSmoothingEnabled = false
      for (const command of commands) {
        switch (command.kind) {
          case 'image': {
            const source =
              command.tint === undefined
                ? getCachedImageCanvas(command.imageName)
                : getTintedImageCanvas(command.imageName, command.tint)
            if (source === null) break
            context.drawImage(
              source,
              0,
              0,
              command.width,
              command.height,
              command.left,
              command.top,
              command.width,
              command.height
            )
            break
          }
          case 'fill': {
            const { left, top, right, bottom } = command.rectangle
            context.fillStyle = getFillStyle(context, command)
            context.fillRect(left, top, right - left, bottom - top)
            break
          }
          case 'text': {
            const fontImage = resources.getFontImage(command.fontName)
            if (fontImage !== null) {
              painter.drawGlyphs(context, fontImage, command.glyphs, command.color)
            }
            break
          }
          case 'viewport': {
            if (menuViewport.draw(context, command, deltaMilliseconds)) break
            const { left, top, right, bottom } = command.rectangle
            context.fillStyle = 'rgba(0, 0, 0, 0.35)'
            context.fillRect(left, top, right - left, bottom - top)
            break
          }
        }
      }
    },
    dispose: () => menuViewport.dispose(),
  })
}
