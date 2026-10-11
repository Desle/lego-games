import { getTextWidth } from '@lego-games/lego-racers/font-rendering'
import { HudFont } from '@lego-games/lego-racers/race-hud'
import type { HudMeasureText } from '@lego-games/lego-racers/race-hud'
import type { HudFonts, HudImage } from '../race-assets/race-assets.types.ts'

// FUN_00408be0: the size of a string in the HUD's bitmap font, in the font's own pixels.
export const createHudTextMeasure =
  (fonts: HudFonts): HudMeasureText =>
  (font, text) => {
    const hudFont = fonts.get(font) ?? fonts.get(HudFont.TEXT)
    if (hudFont === undefined) return { width: 0, height: 0 }
    return getTextWidth(
      hudFont.font,
      Array.from(text, (letter) => letter.charCodeAt(0))
    )
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
