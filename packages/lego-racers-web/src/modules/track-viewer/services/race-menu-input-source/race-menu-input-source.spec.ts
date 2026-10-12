import { createRaceMenuInputSource } from './race-menu-input-source.ts'

const pressKey = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code }))

describe('createRaceMenuInputSource', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'getGamepads', { value: () => [], configurable: true })
  })

  it('hands each key to its own frame, in the order pressed', () => {
    // Arrange
    const source = createRaceMenuInputSource()

    // Act
    pressKey('ArrowDown')
    pressKey('ArrowDown')
    pressKey('Enter')
    const frames = [source.read(), source.read(), source.read(), source.read()]
    source.dispose()

    // Assert
    expect(frames.map((frame) => frame.selectionChange)).toEqual([1, 1, 0, 0])
    expect(frames.map((frame) => frame.isConfirmPressed)).toEqual([false, false, true, false])
  })

  it('maps escape to the pause key and the window losing focus too', () => {
    // Arrange
    const source = createRaceMenuInputSource()

    // Act
    pressKey('Escape')
    window.dispatchEvent(new Event('blur'))
    const frames = [source.read(), source.read()]
    source.dispose()

    // Assert
    expect(frames.map((frame) => frame.isPausePressed)).toEqual([true, true])
  })

  it('reports nothing when no key was pressed', () => {
    // Arrange
    const source = createRaceMenuInputSource()

    // Act
    const frame = source.read()
    source.dispose()

    // Assert
    expect(frame.isAnyInputPressed).toBe(false)
  })
})
