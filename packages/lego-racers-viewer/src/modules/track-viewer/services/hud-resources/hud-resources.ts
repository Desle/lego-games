import { HudFont } from '@lego-games/lego-racers/race-hud'
import type { HudMeasureText } from '@lego-games/lego-racers/race-hud'
import { HUD_FONT_FAMILY, HUD_FONT_SIZES } from '../../types/hud-fonts/hud-fonts.ts'
import type { HudImage } from '../race-assets/race-assets.types.ts'

export const createHudTextMeasure = (): HudMeasureText => {
  const context = document.createElement('canvas').getContext('2d')
  return (font, text) => {
    const size = HUD_FONT_SIZES[font] ?? HUD_FONT_SIZES[HudFont.TEXT] ?? 16
    if (context === null) return { width: Math.ceil(text.length * size * 0.6), height: size }
    context.font = `${String(size)}px ${HUD_FONT_FAMILY}`
    return { width: Math.ceil(context.measureText(text).width), height: size }
  }
}

// A data URL per HUD image so the overlay can show them as plain images.
export const createHudImageUrls = (
  images: ReadonlyMap<string, HudImage>
): ReadonlyMap<string, string> =>
  new Map(
    [...images].flatMap(([name, image]) => {
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext('2d')
      if (context === null) return []
      context.putImageData(
        new ImageData(new Uint8ClampedArray(image.colors), image.width, image.height),
        0,
        0
      )
      return [[name, canvas.toDataURL()] as const]
    })
  )
