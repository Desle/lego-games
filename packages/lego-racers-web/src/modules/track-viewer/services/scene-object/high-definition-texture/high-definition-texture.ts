import { DEVELOPMENT_HIGH_DEFINITION_ROUTE } from '../../../../../shared/development-jam/development-jam-route.ts'
import type { TexturePixels } from './high-definition-texture.types.ts'

export const getIsHighDefinitionEnabled = (search: string): boolean =>
  import.meta.env.DEV && new URLSearchParams(search).has('hd')

export const getHighDefinitionUrl = (bitmapPath: string): string =>
  `${DEVELOPMENT_HIGH_DEFINITION_ROUTE}/${bitmapPath.replaceAll('\\', '/').replace(/\.[^./]+$/, '.png')}`

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

const readPixels = async (url: string): Promise<TexturePixels | null> => {
  const response = await fetch(url)
  if (!response.ok) return null
  const image = await createImageBitmap(await response.blob())
  const canvas = new OffscreenCanvas(image.width, image.height)
  const context = canvas.getContext('2d')
  if (context === null) return null
  context.drawImage(image, 0, 0)
  const data = context.getImageData(0, 0, image.width, image.height).data
  return { colors: new Uint8Array(data.buffer), width: image.width, height: image.height }
}

// The pack's picture for a bitmap, masked by the original's alpha, or null when the pack has none.
export const loadHighDefinitionPixels = async (
  bitmapPath: string,
  original: TexturePixels
): Promise<TexturePixels | null> => {
  const pack = await readPixels(getHighDefinitionUrl(bitmapPath)).catch(() => null)
  if (pack === null) return null
  return { colors: getMaskedColors(pack, original), width: pack.width, height: pack.height }
}
