import { getTextWidth } from '@lego-games/lego-racers/font-rendering'
import { getHudLayout, HudFont } from '@lego-games/lego-racers/race-hud'
import type { HudContext } from '@lego-games/lego-racers/race-presentation'
import type { HudMeasureText } from '@lego-games/lego-racers/race-hud'
import type { HudFonts, HudImage } from '../../types/hud-fonts/hud-fonts.types.ts'
import type { RaceAssets } from '../race-assets/race-assets.types.ts'
import type { RaceStageSize } from '../race-viewport/race-viewport.types.ts'

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

const HOLDER_IMAGE_NAME = 'HOLDER'
const FALLBACK_HOLDER_SIZE = Object.freeze({ width: 64, height: 64 })

// The HUD's layout and text measure for a stage of this size.
export const getHudContext = (assets: RaceAssets, stageSize: RaceStageSize): HudContext => {
  const measureText = createHudTextMeasure(assets.hudFonts)
  const getString = (stringId: number) => assets.getString(stringId)
  const holder = assets.hudImages.get(HOLDER_IMAGE_NAME) ?? FALLBACK_HOLDER_SIZE
  return {
    layout: getHudLayout({
      screenWidth: stageSize.width,
      screenHeight: stageSize.height,
      measureText,
      getString,
      holderSize: { width: holder.width, height: holder.height },
    }),
    getString,
    imageNames: assets.imageNames,
    getImageSize: (name) => assets.hudImages.get(name.toUpperCase()) ?? null,
    measureText,
  }
}

