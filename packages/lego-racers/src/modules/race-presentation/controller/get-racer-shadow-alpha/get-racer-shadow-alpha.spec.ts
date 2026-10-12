import { getRacerShadowAlpha } from './get-racer-shadow-alpha.ts'
import type { RacerShadow } from '../../types/race-presentation.types.ts'

const shadow: RacerShadow = {
  placement: {
    position: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: -1 },
    upHint: { x: 0, y: 1, z: 0 },
    width: 8,
    height: 9,
    depth: 15,
  },
}

describe('getRacerShadowAlpha', () => {
  it('draws at the full alpha within 50 units', () => {
    // Arrange
    const eye = { x: 30, y: 40, z: 0 }

    // Act
    const alpha = getRacerShadowAlpha(shadow, eye)

    // Assert
    expect(alpha).toBe(0xbf)
  })

  it('fades between 50 and 100 units', () => {
    // Arrange
    const eye = { x: 75, y: 0, z: 0 }

    // Act
    const alpha = getRacerShadowAlpha(shadow, eye)

    // Assert
    expect(alpha).toBe(0xbf - Math.trunc(((5625 - 2500) / 7500) * 191))
  })

  it('does not draw from 100 units', () => {
    // Arrange
    const eye = { x: 100, y: 0, z: 0 }

    // Act
    const alpha = getRacerShadowAlpha(shadow, eye)

    // Assert
    expect(alpha).toBeNull()
  })
})
