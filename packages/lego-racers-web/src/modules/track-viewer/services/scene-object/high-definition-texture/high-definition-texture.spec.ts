import {
  getHighDefinitionPixelRatio,
  getHighDefinitionUrl,
  getHighDefinitionVariant,
  getMaskedColors,
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

describe('getHighDefinitionPixelRatio', () => {
  it('draws the stage with as many device pixels as it covers', () => {
    // Arrange
    const stage = { width: 800, height: 600 }
    const window = { innerWidth: 1600, innerHeight: 1000, devicePixelRatio: 2 }

    // Act
    const ratio = getHighDefinitionPixelRatio(stage, window)

    // Assert
    expect(ratio).toBeCloseTo((1000 / 600) * 2)
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
    expect(variants).toEqual(['nomos8k-dat', 'ultrasharp'])
  })
})
