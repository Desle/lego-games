import type { OriginalTexture } from '../../types/presentation-trace.types.ts'
import type { DecodedTexture } from './pixel-trace.types.ts'

const CHANNEL_MAXIMUM = 255
const BITS_PER_BYTE = 8
const CHANNEL_COUNT = 4

export const getChannel = (value: number, mask: number): number => {
  if (mask === 0) return CHANNEL_MAXIMUM
  const shift = Math.clz32(mask & -mask) ^ 31
  const maximum = mask >>> shift
  return Math.round((((value & mask) >>> shift) * CHANNEL_MAXIMUM) / maximum)
}

const getPixelValue = (texture: OriginalTexture, x: number, y: number): number => {
  const bytesPerPixel = texture.bitsPerPixel / BITS_PER_BYTE
  const offset = y * texture.pitch + x * bytesPerPixel
  let value = 0
  for (let byte = 0; byte < bytesPerPixel; byte++) {
    value += (texture.pixels[offset + byte] ?? 0) * 2 ** (BITS_PER_BYTE * byte)
  }
  return value
}

// The surface the original handed Direct3D as RGBA bytes: each channel scaled from its mask to 0..255, an absent alpha is opaque.
export const decodeTexture = (texture: OriginalTexture): DecodedTexture => {
  const colors = new Uint8ClampedArray(texture.width * texture.height * CHANNEL_COUNT)
  const [redMask = 0, greenMask = 0, blueMask = 0, alphaMask = 0] = texture.masks
  for (let y = 0; y < texture.height; y++) {
    for (let x = 0; x < texture.width; x++) {
      const value = getPixelValue(texture, x, y)
      const offset = (y * texture.width + x) * CHANNEL_COUNT
      colors[offset] = getChannel(value, redMask)
      colors[offset + 1] = getChannel(value, greenMask)
      colors[offset + 2] = getChannel(value, blueMask)
      colors[offset + 3] = getChannel(value, alphaMask)
    }
  }
  return Object.freeze({ width: texture.width, height: texture.height, colors })
}
