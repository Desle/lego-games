import { createCameraFovEffect, getCameraFovEffectWithWarp } from './camera-fov-effect.ts'

describe('getCameraFovEffectWithWarp', () => {
  it('raises the base the view eases to by 30 degrees while the warp starts (0x0045d560)', () => {
    // Arrange
    const effect = createCameraFovEffect()

    // Act
    const starting = getCameraFovEffectWithWarp(effect, true, false)

    // Assert
    expect(starting.baseFov).toBe(95)
    expect(starting.fov).toBe(65)
  })

  it('puts the view and the base back while the player is carried (0x0045dc90, 0x0045d940)', () => {
    // Arrange
    const effect = Object.freeze({ ...createCameraFovEffect(), baseFov: 95, fov: 80 })

    // Act
    const carried = getCameraFovEffectWithWarp(effect, false, true)

    // Assert
    expect(carried.baseFov).toBe(65)
    expect(carried.fov).toBe(65)
  })

  it('leaves the effect alone without a warp', () => {
    // Arrange
    const effect = createCameraFovEffect()

    // Act / Assert
    expect(getCameraFovEffectWithWarp(effect, false, false)).toBe(effect)
  })
})
