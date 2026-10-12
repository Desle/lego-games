import { developmentToolsState } from './development-tools-state.ts'

describe('developmentToolsState', () => {
  it('tells its listeners when the overlay opens and stops after unsubscribing', () => {
    // Arrange
    const listener = vi.fn()
    const unsubscribe = developmentToolsState.subscribe(listener)

    // Act
    developmentToolsState.setIsOpen(true)
    unsubscribe()
    developmentToolsState.setIsOpen(false)

    // Assert
    expect(listener).toHaveBeenCalledTimes(1)
    expect(developmentToolsState.getIsOpen()).toBe(false)
  })
})
