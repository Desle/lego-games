import { getShadowMode, getShadowModeFromLabel, getShadowModeLabel } from './shadow-mode.ts'
import { ShadowMode } from './shadow-mode.types.ts'

describe('getShadowMode', () => {
  it('turns real shadows with scenery on with the remastered layer and reads the other two from the address', () => {
    // Arrange / Act
    const modes = ['?hd', '?hd&shadows=classic', '?hd&shadows=real', '?hd&shadows=odd'].map(
      getShadowMode
    )

    // Assert
    expect(modes).toEqual([
      ShadowMode.SCENERY,
      ShadowMode.CLASSIC,
      ShadowMode.REAL,
      ShadowMode.SCENERY,
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
