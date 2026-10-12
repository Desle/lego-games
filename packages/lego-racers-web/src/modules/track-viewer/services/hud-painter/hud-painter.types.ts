import type { HudCommand } from '@lego-games/lego-racers/race-hud'
import type { HudFonts } from '../../types/hud-fonts/hud-fonts.types.ts'
import type { BitmapFontPainter } from '../bitmap-font-painter/bitmap-font-painter.types.ts'

export type HudPaintInput = {
  readonly commands: readonly HudCommand[]
  // The HUD's bitmap fonts by HudFont value.
  readonly fonts: HudFonts
  // The images the commands draw parts and triangles of, by upper case image database name.
  readonly loadedImages: ReadonlyMap<string, HTMLImageElement>
  // Picture pixels per original pixel, by the same names (1 for a name left out): source rectangles are in the original's pixels.
  readonly imageScales: ReadonlyMap<string, number>
  readonly painter: BitmapFontPainter
  readonly width: number
  readonly height: number
  // The overlay shows whole images as page elements; the pixel trace paints them too, as the page would show them.
  readonly isImagePainted: boolean
}
