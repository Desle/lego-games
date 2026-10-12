import type { OriginalTexture } from '../../types/presentation-trace.types.ts'
import { decodeTexture } from './decode-texture.ts'

const KEY = 0xf800

const getTexture = (colorKey: OriginalTexture['colorKey']): OriginalTexture => ({
  hash: 'texture',
  width: 2,
  height: 1,
  pitch: 4,
  bitsPerPixel: 16,
  masks: [0xf800, 0x07e0, 0x001f, 0],
  colorKey,
  // Red (0xf800), then white (0xffff), little-endian.
  pixels: Uint8Array.of(0x00, 0xf8, 0xff, 0xff),
})

describe('decodeTexture', () => {
  it('scales every channel from its mask and makes an absent alpha opaque', () => {
    // Arrange
    const texture = getTexture(null)

    // Act
    const decoded = decodeTexture(texture)

    // Assert
    expect([...decoded.colors]).toEqual([255, 0, 0, 255, 255, 255, 255, 255])
  })

  it('gives the texels inside the colour key alpha 0 only when the key is applied', () => {
    // Arrange
    const texture = getTexture([KEY, KEY])

    // Act
    const plain = decodeTexture(texture)
    const keyed = decodeTexture(texture, true)

    // Assert
    expect([plain.colors[3], plain.colors[7]]).toEqual([255, 255])
    expect([keyed.colors[3], keyed.colors[7]]).toEqual([0, 255])
  })
})
