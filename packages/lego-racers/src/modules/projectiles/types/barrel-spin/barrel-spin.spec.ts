import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import {
  getBarrelLaunchSparksPosition,
  getBarrelSparksPosition,
  getBarrelSpun,
  NO_BARREL_SPIN,
} from './barrel-spin.ts'

const arithmetic = createFloatArithmetic(FpuPrecision.SINGLE)
const getTableCosine = (index: number): number =>
  Math.fround(Math.cos((index * 2 * Math.PI) / 1024))

describe('getBarrelSpun', () => {
  it('grows the spin with the step (0x00452ff0, 0x004b1444)', () => {
    // Arrange
    const milliseconds = 33

    // Act
    const spun = getBarrelSpun(arithmetic, getTableCosine, NO_BARREL_SPIN, milliseconds)

    // Assert
    expect(spun.angle).toBeCloseTo(0.396, 3)
  })

  it('turns the model about y, its first axis (-sine, 0, cosine) and its third (cosine, 0, sine)', () => {
    // Arrange
    const first = getBarrelSpun(arithmetic, getTableCosine, NO_BARREL_SPIN, 33)

    // Act
    const second = getBarrelSpun(arithmetic, getTableCosine, first, 33)

    // Assert
    const [firstX, firstY, firstZ, , , , thirdX, thirdY, thirdZ] = second.rotation
    expect(firstX).toBeCloseTo(-Math.cos(second.angle), 2)
    expect(firstY).toBe(0)
    expect(firstZ).toBeCloseTo(Math.sin(second.angle), 2)
    expect(thirdX).toBeCloseTo(Math.sin(second.angle), 2)
    expect(thirdY).toBe(0)
    expect(thirdZ).toBeCloseTo(Math.cos(second.angle), 2)
  })
})

describe('the barrel sparks', () => {
  it('sit by the frame position along the third axis (cosine, 0, sine) by the three factors (0x00452ff0)', () => {
    // Arrange
    const spin = { ...NO_BARREL_SPIN, cosine: 1, sine: 0.5 }

    // Act
    const position = getBarrelSparksPosition(arithmetic, { x: 10, y: 20, z: 30 }, spin)

    // Assert
    expect(position.x).toBeCloseTo(10 - 0.7279, 3)
    expect(position.y).toBe(20)
    expect(position.z).toBeCloseTo(30 + 0.5 * 5.1782, 3)
  })

  it('start by the frame position the barrel had before it launched (0x00453240)', () => {
    // Arrange
    const before = { x: 10, y: 20, z: 30 }

    // Act
    const position = getBarrelLaunchSparksPosition(arithmetic, before)

    // Assert
    expect(position.x).toBeCloseTo(10 - 0.7279, 3)
    expect(position.y).toBeCloseTo(20.1555, 3)
    expect(position.z).toBeCloseTo(35.1782, 3)
  })
})
