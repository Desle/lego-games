import { getBakedShadowSize } from './baked-shadow-size.ts'

describe('getBakedShadowSize', () => {
  it('uses 4096 on a desktop, 2048 on a small screen, and never more than the card allows', () => {
    // Arrange / Act
    const sizes = [
      getBakedShadowSize(16384, 1080),
      getBakedShadowSize(8192, 390),
      getBakedShadowSize(2048, 1080),
    ]

    // Assert
    expect(sizes).toEqual([4096, 2048, 2048])
  })
})
