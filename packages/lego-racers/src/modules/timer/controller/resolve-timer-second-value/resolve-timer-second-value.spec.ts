import { TimerDivideByZeroError } from '../../types/timer-errors/timer-errors.ts'
import { resolveTimerSecondValue } from './resolve-timer-second-value.ts'

const timer = (secondValue: number, isSecondValueRandomised: boolean) =>
  Object.freeze({
    firstValue: 0,
    isFirstValueMarked: false,
    secondValue,
    isSecondValueRandomised,
    thirdValue: 0,
    identifier: -1,
  })

describe('resolveTimerSecondValue', () => {
  it('keeps a plain value without drawing', () => {
    // Arrange
    const drawRandomValue = vi.fn(() => 7)

    // Act
    const value = resolveTimerSecondValue(timer(3000, false), drawRandomValue)

    // Assert
    expect(value).toBe(3000)
    expect(drawRandomValue).not.toHaveBeenCalled()
  })

  it('takes the draw modulo a value below 0x400', () => {
    // Arrange
    const drawRandomValue = () => 1000

    // Act
    const value = resolveTimerSecondValue(timer(300, true), drawRandomValue)

    // Assert
    expect(value).toBe(100)
  })

  it('multiplies the draw by the value divided by 0x3ff from 0x400 on', () => {
    // Arrange
    const drawRandomValue = () => 1000

    // Act
    const value = resolveTimerSecondValue(timer(3000, true), drawRandomValue)

    // Assert
    expect(value).toBe(2000)
  })

  it('refuses a randomised zero, which divides by zero in the original', () => {
    // Arrange
    const drawRandomValue = () => 1

    // Act
    const resolve = () => resolveTimerSecondValue(timer(0, true), drawRandomValue)

    // Assert
    expect(resolve).toThrow(TimerDivideByZeroError)
  })
})
