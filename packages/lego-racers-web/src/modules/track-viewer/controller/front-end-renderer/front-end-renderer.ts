import { MENU_SURFACE } from '@lego-games/lego-racers/front-end'
import type {
  FrontEndDrawCommand,
  FrontEndFillCommand,
  FrontEndImage,
  FrontEndResources,
} from '@lego-games/lego-racers/front-end'
import type { JamArchive } from '@lego-games/lego-racers/jam-archive'
import { getMenuSurfaceScale } from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import { createMenuViewport } from '../../services/menu-viewport/menu-viewport.ts'
import { createReplaceablePicture } from '../../services/replaceable-picture/replaceable-picture.ts'
import type {
  PictureState,
  ReplaceablePicture,
} from '../../services/replaceable-picture/replaceable-picture.types.ts'
import { createBitmapFontPainter } from '../../services/bitmap-font-painter/bitmap-font-painter.ts'
import type { FrontEndRenderer, PictureCanvas } from './front-end-renderer.types.ts'

const getCssColor = (color: number): string =>
  `rgba(${String((color >>> 16) & 0xff)}, ${String((color >>> 8) & 0xff)}, ${String(color & 0xff)}, ${String(((color >>> 24) & 0xff) / 255)})`

const getImageCanvas = (image: PictureState): HTMLCanvasElement | null => {
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
// game's bitmap fonts from the engine's glyph rectangles. All in the 640 x 480 design's coordinates; an extension may
// ask for a bigger surface and bigger pictures, and everything is then drawn scaled. A 3D viewport command shows the
// item's world, or a dark panel with the name of the object when it has none.
export const createFrontEndRenderer = (
  canvas: HTMLCanvasElement,
  resources: FrontEndResources,
  archive: JamArchive
): FrontEndRenderer => {
  const menuViewport = createMenuViewport(archive)
  let lastTime: number | null = null
  const painter = createBitmapFontPainter()
  const imagePictures = new Map<string, ReplaceablePicture | null>()
  const fontPictures = new Map<string, ReplaceablePicture | null>()
  const getPicture = (
    pictures: Map<string, ReplaceablePicture | null>,
    name: string,
    getImage: (name: string) => FrontEndImage | null
  ): PictureState | null => {
    if (!pictures.has(name)) {
      const image = getImage(name)
      pictures.set(
        name,
        image === null ? null : createReplaceablePicture(image.archivePath, image, () => undefined)
      )
    }
    return pictures.get(name)?.getState() ?? null
  }
  const imageCanvases = new Map<string, PictureCanvas | null>()
  const getCachedImageCanvas = (name: string): PictureCanvas | null => {
    const state = getPicture(imagePictures, name, resources.getImage)
    if (state === null) return null
    const key = `${name}:${String(state.width)}`
    if (!imageCanvases.has(key)) {
      const imageCanvas = getImageCanvas(state)
      imageCanvases.set(
        key,
        imageCanvas === null ? null : { canvas: imageCanvas, sourceScale: state.sourceScale }
      )
    }
    return imageCanvases.get(key) ?? null
  }
  const tintedCanvases = new Map<string, PictureCanvas | null>()
  // The image's pixels multiplied by a colour (the alpha stays the image's), as the device modulates a textured quad.
  const getTintedImageCanvas = (name: string, tint: number): PictureCanvas | null => {
    const source = getCachedImageCanvas(name)
    if (source === null) return null
    const key = `${name}:${String(source.canvas.width)}/${String(tint)}`
    if (!tintedCanvases.has(key)) {
      const tinted = document.createElement('canvas')
      const context = tinted.getContext('2d')
      if (context === null) {
        tintedCanvases.set(key, null)
      } else {
        tinted.width = source.canvas.width
        tinted.height = source.canvas.height
        context.drawImage(source.canvas, 0, 0)
        context.globalCompositeOperation = 'multiply'
        // The frame draws have alpha blending off, so the colour's alpha byte does not show.
        context.fillStyle = getCssColor(tint | 0xff000000)
        context.fillRect(0, 0, tinted.width, tinted.height)
        context.globalCompositeOperation = 'destination-in'
        context.drawImage(source.canvas, 0, 0)
        tintedCanvases.set(key, { canvas: tinted, sourceScale: source.sourceScale })
      }
    }
    return tintedCanvases.get(key) ?? null
  }
  const setSurfaceScale = (surfaceScale: number) => {
    if (surfaceScale === 1) return
    const width = Math.round(MENU_SURFACE.width * surfaceScale)
    const height = Math.round(MENU_SURFACE.height * surfaceScale)
    /* eslint-disable no-param-reassign -- the surface is the canvas's own size and smoothing */
    if (canvas.width !== width) canvas.width = width
    if (canvas.height !== height) canvas.height = height
    canvas.style.imageRendering = 'auto'
    /* eslint-enable no-param-reassign -- back to the rule */
  }
  return Object.freeze({
    draw: (commands: readonly FrontEndDrawCommand[], scriptedMilliseconds?: number) => {
      const context = canvas.getContext('2d')
      if (context === null) return
      const now = performance.now()
      const deltaMilliseconds =
        scriptedMilliseconds ?? (lastTime === null ? 0 : Math.min(100, Math.floor(now - lastTime)))
      lastTime = now
      const surfaceScale = getMenuSurfaceScale(
        (canvas.getBoundingClientRect().width * window.devicePixelRatio) / MENU_SURFACE.width
      )
      setSurfaceScale(surfaceScale)
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.setTransform(surfaceScale, 0, 0, surfaceScale, 0, 0)
      context.imageSmoothingQuality = 'high'
      context.imageSmoothingEnabled = false
      for (const command of commands) {
        switch (command.kind) {
          case 'image': {
            const source =
              command.tint === undefined
                ? getCachedImageCanvas(command.imageName)
                : getTintedImageCanvas(command.imageName, command.tint)
            if (source === null) break
            context.imageSmoothingEnabled = source.sourceScale > 1
            context.drawImage(
              source.canvas,
              0,
              0,
              command.width * source.sourceScale,
              command.height * source.sourceScale,
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
            const fontImage = getPicture(fontPictures, command.fontName, resources.getFontImage)
            if (fontImage !== null) {
              context.imageSmoothingEnabled = fontImage.sourceScale > 1
              painter.drawGlyphs(context, fontImage, command.glyphs, command.color)
            }
            break
          }
          case 'viewport': {
            if (menuViewport.draw(context, command, deltaMilliseconds, surfaceScale)) break
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
