import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import { decodeRouteSample } from './route-sample.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)

describe('decodeRouteSample', () => {
  it('scales the fields as 0x004a5ec0..0x004a5fc0 do, with signed bytes', () => {
    // Arrange
    const sample = { first: -512, second: 128, bytes: [0xf0, 127, 0x81, 0, 0, 0xf8, 16, 0xff] }

    // Act
    const decoded = decodeRouteSample(SINGLE, sample)

    // Assert
    expect(decoded.offset).toEqual({ x: -2, y: 0.5, z: -1 })
    expect(decoded.rotation.x).toBe(Math.fround(127 * Math.fround(0.007874015718698502)))
    expect(decoded.rotation.y).toBe(Math.fround(-127 * Math.fround(0.007874015718698502)))
    expect(decoded.negativeLateralLimit).toBe(-1)
    expect(decoded.positiveLateralLimit).toBe(2)
    expect(decoded.contactState).toBe(4)
    expect(decoded.durationMilliseconds).toBe(63 * 32)
  })
})
