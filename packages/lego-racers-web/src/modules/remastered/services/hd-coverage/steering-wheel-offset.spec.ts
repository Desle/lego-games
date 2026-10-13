import { getSteeringWheelOffset } from './steering-wheel-offset.ts'

describe('getSteeringWheelOffset', () => {
  it('reads the steering wheel of the main file, the car left being LDraw z', () => {
    // Arrange
    const text = ['0 Name: JTCM.ldr', '1 0 22.03 -34 19.53 0 0 -1 0 1 0 1 0 0 3829c01.dat'].join(
      '\n'
    )

    // Act
    const offset = getSteeringWheelOffset(text)

    // Assert
    expect(offset).toBe(19.5)
  })

  it('finds the steering wheel of a chassis recipe where the car file places the recipe', () => {
    // Arrange
    const text = [
      '1 16 -107.97 -26 -60.47 1 0 0 0 1 0 0 0 1 jtchas0.ldr',
      '0 FILE jtchas0.ldr',
      '1 0 130 0 60 0 0 -1 0 1 0 1 0 0 3829c01.dat',
    ].join('\n')

    // Act
    const offset = getSteeringWheelOffset(text)

    // Assert
    expect(offset).toBe(-0.5)
  })

  it('has no offset for a car without a steering wheel', () => {
    // Arrange
    const text = [
      '1 16 -85.47 -24.19 -60 1 0 0 0 1 0 0 0 1 bvbcha0.ldr',
      '0 FILE bvbcha0.ldr',
      '1 8 100 -26 60 0 0 1 0 1 0 -1 0 0 30029.dat',
    ].join('\n')

    // Act
    const offset = getSteeringWheelOffset(text)

    // Assert
    expect(offset).toBeNull()
  })
})
