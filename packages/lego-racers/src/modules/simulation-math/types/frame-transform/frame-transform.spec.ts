import { createFloatArithmetic } from '../float-arithmetic/float-arithmetic.ts'
import { FpuPrecision } from '../fpu-precision/fpu-precision.ts'
import type { Frame } from '../simulation-math.types.ts'
import {
  getFrameInverseRotatedVector,
  getFrameInverseTransformedPoint,
  getFrameRotatedVector,
  getFrameTransformedPoint,
} from './frame-transform.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)

// Rows: x → y, y → -x, z → z (a quarter turn about z), at (10, 20, 30).
const FRAME: Frame = {
  rotation: [0, 1, 0, -1, 0, 0, 0, 0, 1],
  position: { x: 10, y: 20, z: 30 },
}

describe('frame transforms', () => {
  it('turns a frame point into the world (0x00410d60) and back (0x00410de0)', () => {
    // Arrange
    const local = { x: 1, y: 2, z: 3 }

    // Act
    const world = getFrameTransformedPoint(SINGLE, FRAME, local)
    const back = getFrameInverseTransformedPoint(SINGLE, FRAME, world)

    // Assert
    expect(world).toEqual({ x: 8, y: 21, z: 33 })
    expect(back).toEqual(local)
  })

  it('rotates a vector without the position (0x00410c80, 0x00410cf0)', () => {
    // Arrange
    const vector = { x: 1, y: 0, z: 0 }

    // Act
    const world = getFrameRotatedVector(SINGLE, FRAME, vector)
    const local = getFrameInverseRotatedVector(SINGLE, FRAME, world)

    // Assert
    expect(world).toEqual({ x: 0, y: 1, z: 0 })
    expect(local).toEqual(vector)
  })

  it('stores the sum after each term, so single and double precision agree on float32 inputs', () => {
    // Arrange
    const double = createFloatArithmetic(FpuPrecision.DOUBLE)
    const frame: Frame = {
      rotation: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map(
        Math.fround
      ) as unknown as Frame['rotation'],
      position: { x: Math.fround(0.3), y: 0, z: 0 },
    }
    const point = { x: Math.fround(1.1), y: Math.fround(2.2), z: Math.fround(3.3) }

    // Act
    const results = [SINGLE, double].map((arithmetic) =>
      getFrameTransformedPoint(arithmetic, frame, point)
    )

    // Assert
    expect(results[0]).toEqual(results[1])
  })
})
