import type { RasterisedFrame } from '../pixel-trace.types.ts'
import { comparePixels } from './compare-pixels.ts'

const SIZE = 64
const getImage = (value: number): Uint8ClampedArray =>
  new Uint8ClampedArray(SIZE * SIZE * 4).fill(value)

const getReference = (): RasterisedFrame => ({
  width: SIZE,
  height: SIZE,
  colors: getImage(100),
  textureIndices: new Int16Array(SIZE * SIZE).fill(0),
  textureHashes: ['abc'],
})

const getInput = (port: Uint8ClampedArray) => ({
  reference: getReference(),
  port: { width: SIZE, height: SIZE, colors: port },
  tolerance: { channelLevels: 8 },
  textureLabels: new Map([['abc', 'oilslk64']]),
  maximumRegionCount: 4,
})

describe('comparePixels', () => {
  it('finds no difference between equal pictures', () => {
    // Arrange
    const input = getInput(getImage(100))

    // Act
    const comparison = comparePixels(input)

    // Assert
    expect(comparison.differingCount).toBe(0)
    expect(comparison.regions).toEqual([])
  })

  it('names the box and the texture of a block that differs', () => {
    // Arrange
    const port = getImage(100)
    for (let row = 16; row < 32; row++) {
      for (let column = 32; column < 48; column++) {
        port.fill(200, (row * SIZE + column) * 4, (row * SIZE + column) * 4 + 3)
      }
    }

    // Act
    const comparison = comparePixels(getInput(port))

    // Assert
    expect(comparison.differingCount).toBe(256)
    expect(comparison.regions).toHaveLength(1)
    expect(comparison.regions[0]).toMatchObject({
      left: 32,
      right: 47,
      top: 16,
      bottom: 31,
      meanReference: [100, 100, 100],
      meanPort: [200, 200, 200],
      dominantTextures: [{ label: 'oilslk64', count: 256 }],
    })
  })

  it('forgives differences within the tolerance', () => {
    // Arrange
    const input = getInput(getImage(105))

    // Act
    const comparison = comparePixels(input)

    // Assert
    expect(comparison.differingShare).toBe(0)
  })
})
