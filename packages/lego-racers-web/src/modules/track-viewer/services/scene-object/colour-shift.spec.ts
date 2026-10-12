import { BufferAttribute, BufferGeometry } from 'three'
import { applyColourShift } from './colour-shift.ts'

const createGeometry = (isPrelit: boolean) => {
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'color',
    new BufferAttribute(Uint8Array.from([255, 31, 200, 255, 100, 100, 100, 128]), 4, true)
  )
  geometry.userData['isPrelit'] = isPrelit
  return geometry
}

const getColors = (geometry: BufferGeometry) =>
  Array.from((geometry.getAttribute('color') as BufferAttribute).array)

describe('applyColourShift (GolDP.dll 0x10017050)', () => {
  it('halves red, green and blue, keeps alpha, and adds the bias with a clamp', () => {
    // Arrange
    const geometry = createGeometry(true)

    // Act
    applyColourShift(geometry, { shifts: [1, 1, 1, 0], biases: [0, 0, 100, 0] })

    // Assert
    expect(getColors(geometry)).toEqual([127, 15, 200, 255, 50, 50, 150, 128])
  })

  it('restores the colours the mesh was built with', () => {
    // Arrange
    const geometry = createGeometry(true)
    applyColourShift(geometry, { shifts: [1, 1, 1, 0], biases: [0, 0, 0, 0] })

    // Act
    applyColourShift(geometry, null)

    // Assert
    expect(getColors(geometry)).toEqual([255, 31, 200, 255, 100, 100, 100, 128])
  })

  it('leaves a lit mesh alone: its colours come from the light function', () => {
    // Arrange
    const geometry = createGeometry(false)

    // Act
    applyColourShift(geometry, { shifts: [1, 1, 1, 0], biases: [0, 0, 0, 0] })

    // Assert
    expect(getColors(geometry)).toEqual([255, 31, 200, 255, 100, 100, 100, 128])
  })
})
