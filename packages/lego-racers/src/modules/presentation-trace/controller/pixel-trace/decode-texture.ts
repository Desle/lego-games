import type { OriginalTexture } from '../../types/presentation-trace.types.ts'
import type { DecodedTexture } from './pixel-trace.types.ts'

const CHANNEL_MAXIMUM = 255 // @check-allow traced-constants: surface decoding arithmetic (channels, bit widths), not original behaviour
const BITS_PER_BYTE = 8 // @check-allow traced-constants: surface decoding arithmetic (channels, bit widths), not original behaviour
const CHANNEL_COUNT = 4 // @check-allow traced-constants: surface decoding arithmetic (channels, bit widths), not original behaviour

export const getChannel = (value: number, mask: number): number => {
  if (mask === 0) return CHANNEL_MAXIMUM
  const shift = Math.clz32(mask & -mask) ^ 31 // @check-allow traced-constants: surface decoding arithmetic (channels, bit widths), not original behaviour
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
  const keyedTexels =
    texture.colorKey === null ? null : new Uint8Array(texture.width * texture.height)
  const [redMask = 0, greenMask = 0, blueMask = 0, alphaMask = 0] = texture.masks
  for (let y = 0; y < texture.height; y++) {
    for (let x = 0; x < texture.width; x++) {
      const value = getPixelValue(texture, x, y)
      const offset = (y * texture.width + x) * CHANNEL_COUNT
      if (keyedTexels !== null && texture.colorKey !== null) {
        keyedTexels[y * texture.width + x] =
          value >= texture.colorKey[0] && value <= texture.colorKey[1] ? 1 : 0
      }
      colors[offset] = getChannel(value, redMask)
      colors[offset + 1] = getChannel(value, greenMask)
      colors[offset + 2] = getChannel(value, blueMask)
      colors[offset + 3] = getChannel(value, alphaMask) // @check-allow traced-constants: surface decoding arithmetic (channels, bit widths), not original behaviour
    }
  }
  return Object.freeze({ width: texture.width, height: texture.height, colors, keyedTexels })
}
