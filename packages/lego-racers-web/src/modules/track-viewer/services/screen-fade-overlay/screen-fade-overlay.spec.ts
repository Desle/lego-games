import { createScreenFadeOverlay } from './screen-fade-overlay.ts'

describe('createScreenFadeOverlay', () => {
  it('shows one quad per draw of a fade, in its colour and alpha', () => {
    // Arrange
    const overlay = createScreenFadeOverlay()

    // Act
    overlay.update([{ red: 0, green: 0, blue: 100, alpha: 255, drawCount: 2 }])

    // Assert
    const visible = overlay.scene.children.filter((child) => child.visible)
    expect(visible).toHaveLength(2)
    overlay.dispose()
  })

  it('hides the quads of a fade that ended', () => {
    // Arrange
    const overlay = createScreenFadeOverlay()
    overlay.update([{ red: 0, green: 0, blue: 100, alpha: 42, drawCount: 1 }])

    // Act
    overlay.update([])

    // Assert
    expect(overlay.scene.children.filter((child) => child.visible)).toHaveLength(0)
    overlay.dispose()
  })
})
