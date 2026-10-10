import {
  createFloatArithmetic,
  FpuPrecision,
  IDENTITY_MATRIX3,
} from '../../../simulation-math/index.ts'
import type { Matrix3 } from '../../../simulation-math/index.ts'
import type { OrientedBox } from '../racer-collision.types.ts'
import { getBoxContact, getBoxOverlap } from './oriented-box.ts'

const arithmetic = createFloatArithmetic(FpuPrecision.SINGLE)
const QUARTER_TURN_COSINE = Math.fround(Math.cos(Math.PI / 4))
const QUARTER_TURN_SINE = Math.fround(Math.sin(Math.PI / 4))
// A quarter of a half turn about z (rows are the axes).
const TURNED: Matrix3 = [
  QUARTER_TURN_COSINE,
  QUARTER_TURN_SINE,
  0,
  -QUARTER_TURN_SINE,
  QUARTER_TURN_COSINE,
  0,
  0,
  0,
  1,
]

const createBox = (
  x: number,
  y: number,
  scale = 1,
  rotation: Matrix3 = IDENTITY_MATRIX3
): OrientedBox => ({
  rotation,
  centre: { x, y, z: 0 },
  dimensions: { x: 2, y: 2, z: 2 },
  scale,
})

// The expected values below are what the original's 0x00441330 returns for the same boxes (run in the x87 emulator).
describe('getBoxContact', () => {
  it('finds the face overlap, the normal toward the first box and the mean of the reaching corners', () => {
    // Arrange
    const first = createBox(0, 0)
    const second = createBox(1.5, 0.2)

    // Act
    const contact = getBoxContact(arithmetic, first, second)

    // Assert
    expect(contact).toEqual({
      depth: 0.5,
      normal: { x: -1, y: -0, z: -0 },
      point: { x: 0.75, y: 0.10000002384185791, z: 0 },
    })
  })

  it('reports no contact for boxes that are apart', () => {
    // Arrange
    const first = createBox(0, 0)
    const second = createBox(3, 0)

    // Act
    const contact = getBoxContact(arithmetic, first, second)

    // Assert
    expect(contact).toBeUndefined()
  })

  it('tests a box turned a quarter against a straight one', () => {
    // Arrange
    const first = createBox(0, 0)
    const second = createBox(2.1, 0, 1, TURNED)

    // Act
    const contact = getBoxContact(arithmetic, first, second)

    // Assert
    expect(contact?.depth).toBe(0.31421375274658203)
    expect(contact?.normal).toEqual({ x: -1, y: -0, z: -0 })
    expect(contact?.point.x).toBe(0.5047378540039062)
  })

  it('shrinks both half extents by the scale of the car body', () => {
    // Arrange
    const first = createBox(0, 0, 0.5)
    const second = createBox(1.2, 0)

    // Act
    const contact = getBoxContact(arithmetic, first, second)

    // Assert
    expect(contact?.depth).toBe(0.2999999523162842)
    expect(contact?.point.x).toBe(0.8500000238418579)
  })

  it('reports no contact for a box scaled to nothing', () => {
    // Arrange
    const first = createBox(0, 0, 0)
    const second = createBox(1, 0)

    // Act
    const contact = getBoxContact(arithmetic, first, second)

    // Assert
    expect(contact).toBeUndefined()
  })
})

describe('getBoxOverlap', () => {
  it('returns the reaches that 0x00441330 compares the corners with', () => {
    // Arrange
    const first = createBox(0, 0)
    const second = createBox(1.5, 0.2)

    // Act
    const overlap = getBoxOverlap(arithmetic, first, second)

    // Assert
    expect(overlap?.firstReach).toBe(0.5)
    expect(overlap?.secondReach).toBe(0.5)
  })
})
