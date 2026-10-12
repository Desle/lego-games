import type { HudFonts, HudImage } from '../../types/hud-fonts/hud-fonts.types.ts'
import { createHudImageUrls } from '../hud-resources/hud-resources.ts'
import type { RaceAssets } from '../race-assets/race-assets.types.ts'
import { createReplaceablePicture } from '../replaceable-picture/replaceable-picture.ts'
import type { PictureState } from '../replaceable-picture/replaceable-picture.types.ts'
import type { HudPictures } from './hud-pictures.types.ts'

const getReplacedImage = (image: HudImage, state: PictureState): HudImage =>
  Object.freeze({ ...image, ...state })

const getHudPictures = (images: ReadonlyMap<string, HudImage>, fonts: HudFonts): HudPictures =>
  Object.freeze({
    imageUrls: createHudImageUrls(images),
    imageScales: new Map([...images].map(([name, image]) => [name, image.sourceScale] as const)),
    fonts,
  })

// Asks the extensions for pictures to replace the HUD's images and font sheets; `onChanged` gets the HUD's pictures again
// whenever one is replaced (never, in Classic).
export const watchHudPictures = (
  assets: RaceAssets,
  onChanged: (pictures: HudPictures) => void
): void => {
  let images: ReadonlyMap<string, HudImage> = assets.hudImages
  let fonts: HudFonts = assets.hudFonts
  for (const [name, image] of assets.hudImages) {
    if (image.archivePath === null) continue
    createReplaceablePicture(image.archivePath, image, (state) => {
      images = new Map([...images, [name, getReplacedImage(image, state)]])
      onChanged(getHudPictures(images, fonts))
    })
  }
  for (const [hudFont, hudBitmapFont] of assets.hudFonts) {
    const { image } = hudBitmapFont
    if (image.archivePath === null) continue
    createReplaceablePicture(image.archivePath, image, (state) => {
      fonts = new Map([
        ...fonts,
        [hudFont, Object.freeze({ ...hudBitmapFont, image: getReplacedImage(image, state) })],
      ])
      onChanged(getHudPictures(images, fonts))
    })
  }
}
