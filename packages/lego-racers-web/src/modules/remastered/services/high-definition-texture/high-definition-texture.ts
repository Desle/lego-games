import { LinearFilter, LinearMipmapLinearFilter } from 'three'
import { DEVELOPMENT_HIGH_DEFINITION_ROUTE } from './high-definition-route.ts'
import type { DeviceMetrics } from './high-definition-texture.types.ts'
import type {
  PictureCreatedEvent,
  TextureCreatedEvent,
  TexturePixels,
} from '../../../../shared/viewer-extensions/viewer-extensions.types.ts'

const DEFAULT_VARIANT = 'ultrasharp'
// Alpha 0 and 255 of neighbouring original pixels meet in the middle of this many pack pixels' ramp (a larger factor, a thinner ramp).
const SMOOTH_EDGE_SHARPNESS = 3

export const getIsHighDefinitionEnabled = (search: string): boolean =>
  import.meta.env.DEV && new URLSearchParams(search).has('hd')

// `?hd=<variant>` picks a pack folder; a bare `?hd` uses the default one.
export const getHighDefinitionVariant = (search: string): string => {
  const variant = new URLSearchParams(search).get('hd') ?? ''
  return variant === '' ? DEFAULT_VARIANT : variant
}

export const getHighDefinitionUrl = (bitmapPath: string, variant: string): string =>
  `${DEVELOPMENT_HIGH_DEFINITION_ROUTE}/${encodeURIComponent(variant)}/${bitmapPath.replaceAll('\\', '/').replace(/\.[^./]+$/, '.png')}`

// The pack's colours with the original's alpha, sampled nearest, so colour-keyed edges stay as crisp as the original's.
export const getMaskedColors = (pack: TexturePixels, original: TexturePixels): Uint8Array => {
  const colors = new Uint8Array(pack.colors)
  for (let row = 0; row < pack.height; row++) {
    const originalRow = Math.floor((row * original.height) / pack.height)
    for (let column = 0; column < pack.width; column++) {
      const originalColumn = Math.floor((column * original.width) / pack.width)
      const alpha = original.colors[(originalRow * original.width + originalColumn) * 4 + 3] ?? 255
      colors[(row * pack.width + column) * 4 + 3] = alpha
    }
  }
  return colors
}

const getOriginalAlpha = (original: TexturePixels, row: number, column: number): number =>
  original.colors[(row * original.width + column) * 4 + 3] ?? 255

// The pack's colours with the original's alpha stretched smoothly over the pack's pixels: the original's transparent
// regions (a colour key) keep a soft, round edge at the pack's resolution, where a nearest mask would be blocky.
export const getSmoothMaskedColors = (
  pack: TexturePixels,
  original: TexturePixels,
  edgeSharpness: number = SMOOTH_EDGE_SHARPNESS
): Uint8Array => {
  const colors = new Uint8Array(pack.colors)
  const lastRow = original.height - 1
  const lastColumn = original.width - 1
  for (let row = 0; row < pack.height; row++) {
    const originalY = Math.min(
      Math.max(((row + 0.5) * original.height) / pack.height - 0.5, 0),
      lastRow
    )
    const topRow = Math.floor(originalY)
    const bottomRow = Math.min(topRow + 1, lastRow)
    const verticalWeight = originalY - topRow
    for (let column = 0; column < pack.width; column++) {
      const originalX = Math.min(
        Math.max(((column + 0.5) * original.width) / pack.width - 0.5, 0),
        lastColumn
      )
      const leftColumn = Math.floor(originalX)
      const rightColumn = Math.min(leftColumn + 1, lastColumn)
      const horizontalWeight = originalX - leftColumn
      const top =
        getOriginalAlpha(original, topRow, leftColumn) * (1 - horizontalWeight) +
        getOriginalAlpha(original, topRow, rightColumn) * horizontalWeight
      const bottom =
        getOriginalAlpha(original, bottomRow, leftColumn) * (1 - horizontalWeight) +
        getOriginalAlpha(original, bottomRow, rightColumn) * horizontalWeight
      const alpha = top * (1 - verticalWeight) + bottom * verticalWeight
      const sharpened = Math.min(Math.max((alpha - 127.5) * edgeSharpness + 127.5, 0), 255)
      colors[(row * pack.width + column) * 4 + 3] = sharpened
    }
  }
  return colors
}

const getIsTarga = (bitmapPath: string): boolean => /\.tga$/i.test(bitmapPath)

// Phones and tablets are short of memory and of upload time: a 2560 x 1920 menu picture is 20 MB of pixels on the GPU. Pictures
// bigger than this are drawn smaller there (`?maxtexture=<pixels>` sets it by hand, `0` lifts it). A desktop keeps the pack as it is.
const SMALL_DEVICE_TEXTURE_SIZE = 1024
const SMALL_DEVICE_LONG_SIDE = 1400
const NO_TEXTURE_LIMIT = Infinity

export const getMaximumTextureSize = (search: string, device: DeviceMetrics): number => {
  const requested = Number(new URLSearchParams(search).get('maxtexture') ?? Number.NaN)
  if (Number.isFinite(requested)) return requested > 0 ? requested : NO_TEXTURE_LIMIT
  const isSmallDevice =
    device.touchPointCount > 0 &&
    Math.max(device.screenWidth, device.screenHeight) <= SMALL_DEVICE_LONG_SIDE
  return isSmallDevice ? SMALL_DEVICE_TEXTURE_SIZE : NO_TEXTURE_LIMIT
}

const getPageTextureLimit = (): number =>
  getMaximumTextureSize(globalThis.location.search, {
    touchPointCount: globalThis.navigator.maxTouchPoints,
    screenWidth: globalThis.screen.width,
    screenHeight: globalThis.screen.height,
  })

const readPixels = async (url: string): Promise<TexturePixels | null> => {
  const response = await fetch(url)
  if (!response.ok) return null
  const image = await createImageBitmap(await response.blob())
  const shrink = Math.min(1, getPageTextureLimit() / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * shrink))
  const height = Math.max(1, Math.round(image.height * shrink))
  const canvas = new OffscreenCanvas(width, height)
  const context = canvas.getContext('2d')
  if (context === null) return null
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, width, height)
  const data = context.getImageData(0, 0, width, height).data
  return { colors: new Uint8Array(data.buffer), width, height }
}

// The pack's picture for a bitmap, masked by the original's alpha, or null when the pack has none.
export const loadHighDefinitionPixels = async (
  bitmapPath: string,
  original: TexturePixels,
  search: string
): Promise<TexturePixels | null> => {
  const variant = getHighDefinitionVariant(search)
  const pack = await readPixels(getHighDefinitionUrl(bitmapPath, variant)).catch(() => null)
  if (pack === null) return null
  // A Targa's alpha is a soft gradient (smoke, flames): stretched as is. A bitmap's is a colour key: nearest keeps its edges crisp.
  const colors = getIsTarga(bitmapPath)
    ? getSmoothMaskedColors(pack, original, 1)
    : getMaskedColors(pack, original)
  return { colors, width: pack.width, height: pack.height }
}

// The pack's picture for a 2D image or font sheet of the archive (original alpha kept smooth), or null when the pack has none.
export const loadHighDefinitionPicture = async (
  archivePath: string,
  original: TexturePixels,
  search: string
): Promise<TexturePixels | null> => {
  const variant = getHighDefinitionVariant(search)
  const pack = await readPixels(getHighDefinitionUrl(archivePath, variant)).catch(() => null)
  if (pack === null) return null
  return { colors: getSmoothMaskedColors(pack, original), width: pack.width, height: pack.height }
}

// Swaps a picture of the menus or the HUD for the pack's once it has loaded; the original's shows until then.
export const applyHighDefinitionPicture = (event: PictureCreatedEvent, search: string) =>
  void loadHighDefinitionPicture(event.archivePath, event.originalPixels, search).then((pixels) =>
    pixels === null ? undefined : event.replacePixels(pixels)
  )

// Swaps a texture's picture for the pack's once it has loaded; the original's picture shows until then.
export const applyHighDefinitionTexture = (event: TextureCreatedEvent, search: string) => {
  const { texture } = event
  void loadHighDefinitionPixels(event.bitmapPath, event.originalPixels, search).then((pixels) => {
    if (pixels === null) return
    if (texture.magFilter === LinearFilter) {
      texture.minFilter = LinearMipmapLinearFilter
      texture.generateMipmaps = true
    }
    event.replacePixels(pixels)
  })
}
