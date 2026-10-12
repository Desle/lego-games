import { DEVELOPMENT_HIGH_DEFINITION_ROUTE } from '../../../../../shared/development-jam/development-jam-route.ts'
import type { StageSize, TexturePixels, WindowMetrics } from './high-definition-texture.types.ts'

const DEFAULT_VARIANT = 'ultrasharp'

// The page's query string, or none when the viewport runs outside a page (the Node trace harnesses).
export const getPageSearch = (): string =>
  'location' in globalThis ? globalThis.location.search : ''

export const getIsHighDefinitionEnabled = (search: string): boolean =>
  import.meta.env.DEV && new URLSearchParams(search).has('hd')

// `?hd=<variant>` picks a pack folder; a bare `?hd` uses the default one.
export const getHighDefinitionVariant = (search: string): string => {
  const variant = new URLSearchParams(search).get('hd') ?? ''
  return variant === '' ? DEFAULT_VARIANT : variant
}

// In the high-definition view the fixed stage is drawn with as many device pixels as it covers on screen.
export const getHighDefinitionPixelRatio = (stage: StageSize, window: WindowMetrics): number =>
  Math.min(window.innerWidth / stage.width, window.innerHeight / stage.height) *
  window.devicePixelRatio

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
  const variant = getHighDefinitionVariant(getPageSearch())
  const pack = await readPixels(getHighDefinitionUrl(bitmapPath, variant)).catch(() => null)
  if (pack === null) return null
  return { colors: getMaskedColors(pack, original), width: pack.width, height: pack.height }
}
