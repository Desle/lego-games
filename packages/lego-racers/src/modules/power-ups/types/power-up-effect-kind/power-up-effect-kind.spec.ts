import { BrickKind } from '../brick-kind/brick-kind.ts'
import {
  getPowerUpEffectCategory,
  getPowerUpEffectKind,
  InvalidEnhancementLevelError,
  PowerUpEffectKind,
} from './power-up-effect-kind.ts'

describe('getPowerUpEffectKind', () => {
  it('maps each colour and level to its class (0x0045a950, 0x0045a9b0, 0x0045b030, 0x0045b1e0)', () => {
    // Arrange
    const levels = [0, 1, 2, 3]

    // Act
    const projectiles = levels.map((level) => getPowerUpEffectKind(BrickKind.PROJECTILE, level))
    const hazards = levels.map((level) => getPowerUpEffectKind(BrickKind.HAZARD, level))
    const turbos = levels.map((level) => getPowerUpEffectKind(BrickKind.TURBO, level))

    // Assert
    expect(projectiles).toEqual(['cannon', 'grapple', 'wand', 'rocket'])
    expect(hazards).toEqual(['oil_slick', 'barrel', 'magnet', 'curse'])
    expect(turbos).toEqual(['turbo', 'turbo', 'turbo', 'warp'])
  })

  it('rejects a level above 3', () => {
    // Arrange
    const level = 4

    // Act
    const getKind = () => getPowerUpEffectKind(BrickKind.SHIELD, level)

    // Assert
    expect(getKind).toThrow(InvalidEnhancementLevelError)
  })
})

describe('getPowerUpEffectCategory', () => {
  it('returns the vtable slot 6 category', () => {
    // Arrange
    const kinds = [PowerUpEffectKind.WARP, PowerUpEffectKind.CURSE, PowerUpEffectKind.SHIELD]

    // Act
    const categories = kinds.map(getPowerUpEffectCategory)

    // Assert
    expect(categories).toEqual([BrickKind.TURBO, BrickKind.HAZARD, BrickKind.SHIELD])
  })
})
