import { createDecalFrame } from './create-decal-frame.ts'

describe('createDecalFrame', () => {
  it('makes the up vector perpendicular to the normal and the right vector their cross product', () => {
    // Arrange
    const placement = {
      position: { x: 1, y: 2, z: 3 },
      normal: { x: 0, y: 0, z: -2 },
      upHint: { x: 0, y: 1, z: 1 },
      width: 4,
      height: 6,
      depth: 15,
    }

    // Act
    const frame = createDecalFrame(placement)

    // Assert
    expect(frame.normal).toEqual({ x: 0, y: 0, z: -1 })
    expect(frame.up).toEqual({ x: 0, y: 1, z: 0 })
    expect(frame.right).toEqual({ x: -1, y: 0, z: 0 })
    expect(frame.position).toBe(placement.position)
  })

  it('keeps a zero normal at zero', () => {
    // Arrange
    const zero = { x: 0, y: 0, z: 0 }

    // Act
    const frame = createDecalFrame({
      position: zero,
      normal: zero,
      upHint: { x: 0, y: 1, z: 0 },
      width: 1,
      height: 1,
      depth: 1,
    })

    // Assert
    expect(frame.normal).toEqual(zero)
    expect(frame.up).toEqual({ x: 0, y: 1, z: 0 })
  })
})
