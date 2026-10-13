import { DataTexture } from 'three'
import {
  applyHighDefinitionTexture,
  getHighDefinitionUrl,
  getHighDefinitionVariant,
  getMaximumTextureSize,
  getMaskedColors,
  getSmoothMaskedColors,
} from './high-definition-texture.ts'

describe('getHighDefinitionUrl', () => {
  it('maps an archive bitmap path to the pack PNG', () => {
    // Arrange
    const bitmapPath = 'GAMEDATA\\COMMON\\RH_CAR.BMP'

    // Act
    const url = getHighDefinitionUrl(bitmapPath, 'ultrasharp')

    // Assert
    expect(url).toBe('/__development/high-definition/ultrasharp/GAMEDATA/COMMON/RH_CAR.png')
  })
})

describe('getMaskedColors', () => {
  it('keeps the pack colours and takes alpha from the original, nearest', () => {
    // Arrange
    const original = { colors: new Uint8Array([9, 9, 9, 0, 9, 9, 9, 255]), width: 2, height: 1 }
    const pack = { colors: new Uint8Array(4 * 4).fill(200), width: 4, height: 1 }

    // Act
    const colors = getMaskedColors(pack, original)

    // Assert
    expect([...colors]).toEqual([
      200, 200, 200, 0, 200, 200, 200, 0, 200, 200, 200, 255, 200, 200, 200, 255,
    ])
  })
})

describe('getHighDefinitionVariant', () => {
  it('uses the named pack, or the default for a bare flag', () => {
    // Arrange
    const named = '?hd=nomos8k-dat'
    const bare = '?hd'

    // Act
    const variants = [getHighDefinitionVariant(named), getHighDefinitionVariant(bare)]

    // Assert
    expect(variants).toEqual(['nomos8k-dat', 'ultrasharp-v2'])
  })
})

describe('applyHighDefinitionTexture', () => {
  it('keeps the original picture when the pack has none', async () => {
    // Arrange
    const replacePixels = vi.fn()
    vi.stubGlobal('fetch', () => Promise.resolve({ ok: false }))
    const event = {
      texture: new DataTexture(new Uint8Array(4), 1, 1),
      bitmapPath: 'GAMEDATA\\COMMON\\RH_CAR.BMP',
      originalPixels: { colors: new Uint8Array(4), width: 1, height: 1 },
      replacePixels,
    }

    // Act
    applyHighDefinitionTexture(event, '?hd')
    await new Promise((resolve) => setTimeout(resolve, 0))
    vi.unstubAllGlobals()

    // Assert
    expect(replacePixels).not.toHaveBeenCalled()
  })
})

describe('getSmoothMaskedColors', () => {
  it('stretches the original alpha smoothly over the pack pixels', () => {
    // Arrange
    const original = { colors: new Uint8Array([9, 9, 9, 0, 9, 9, 9, 255]), width: 2, height: 1 }
    const pack = { colors: new Uint8Array(4 * 4).fill(200), width: 4, height: 1 }

    // Act
    const colors = getSmoothMaskedColors(pack, original, 1)

    // Assert
    expect([0, 1, 2, 3].map((column) => colors[column * 4 + 3])).toEqual([0, 63, 191, 255])
  })
})

describe('getMaximumTextureSize', () => {
  it('caps the pack on a phone and a tablet and leaves a desktop alone', () => {
    // Arrange
    const phone = { touchPointCount: 5, screenWidth: 390, screenHeight: 844 }
    const tablet = { touchPointCount: 5, screenWidth: 1024, screenHeight: 1366 }
    const desktop = { touchPointCount: 0, screenWidth: 2560, screenHeight: 1440 }

    // Act
    const sizes = [phone, tablet, desktop].map((device) => getMaximumTextureSize('?hd', device))

    // Assert
    expect(sizes).toEqual([1024, 1024, Infinity])
  })

  it('takes the size the address asks for, and no limit for 0', () => {
    // Arrange
    const desktop = { touchPointCount: 0, screenWidth: 2560, screenHeight: 1440 }
    const phone = { touchPointCount: 5, screenWidth: 390, screenHeight: 844 }

    // Act
    const sizes = [
      getMaximumTextureSize('?hd&maxtexture=512', desktop),
      getMaximumTextureSize('?hd&maxtexture=0', phone),
    ]

    // Assert
    expect(sizes).toEqual([512, Infinity])
  })
})
