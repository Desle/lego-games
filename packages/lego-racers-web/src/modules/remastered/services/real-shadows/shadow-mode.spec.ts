import { getShadowMode, getShadowModeFromLabel, getShadowModeLabel } from './shadow-mode.ts'
import { ShadowMode } from './shadow-mode.types.ts'

describe('getShadowMode', () => {
  it('turns real shadows on with the remastered layer and reads the other two from the address', () => {
    // Arrange / Act
    const modes = ['?hd', '?hd&shadows=classic', '?hd&shadows=scenery', '?hd&shadows=odd'].map(
      getShadowMode
    )

    // Assert
    expect(modes).toEqual([
      ShadowMode.REAL,
      ShadowMode.CLASSIC,
      ShadowMode.SCENERY,
      ShadowMode.REAL,
    ])
  })
})

describe('shadow mode labels', () => {
  it('round-trips the developer panel choices, Classic being no choice', () => {
    // Arrange / Act
    const labels = Object.values(ShadowMode).map(getShadowModeLabel)

    // Assert
    expect(labels).toEqual([null, 'Real', 'Real + scenery'])
    expect(labels.map(getShadowModeFromLabel)).toEqual(Object.values(ShadowMode))
  })
})
