import { getHighDefinitionUrl, getMaskedColors } from './high-definition-texture.ts'

describe('getHighDefinitionUrl', () => {
  it('maps an archive bitmap path to the pack PNG', () => {
    // Arrange
    const bitmapPath = 'GAMEDATA\\COMMON\\RH_CAR.BMP'

    // Act
    const url = getHighDefinitionUrl(bitmapPath)

    // Assert
    expect(url).toBe('/__development/high-definition/GAMEDATA/COMMON/RH_CAR.png')
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
