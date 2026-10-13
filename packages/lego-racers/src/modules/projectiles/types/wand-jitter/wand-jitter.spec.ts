import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import { getJitterValue, getWandJitter } from './wand-jitter.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)
const SLOT_COUNT = 20
const draws = Array.from({ length: SLOT_COUNT }, (_, slot) => slot * 50)

describe('getJitterValue (0x00454b20)', () => {
  it('maps the table value 0..1023 to -2.5..2.5', () => {
    // Arrange / Act / Assert
    expect(getJitterValue(SINGLE, 0)).toBe(-2.5)
    expect(getJitterValue(SINGLE, 1023)).toBeCloseTo(2.5, 5)
    expect(getJitterValue(SINGLE, 527)).toBeCloseTo(0.0757575, 5)
  })
})

describe('getWandJitter (0x00454bb0)', () => {
  it('reads five slots a segment, counting down from the slot before the next draw', () => {
    // Arrange / Act
    const jitter = getWandJitter(SINGLE, draws, 10)

    // Assert
    expect(jitter).toHaveLength(4)
    expect(jitter[0]).toHaveLength(5)
    expect(jitter[0]?.[0]?.x).toBe(getJitterValue(SINGLE, draws[9] ?? 0))
    expect(jitter[0]?.[4]?.x).toBe(getJitterValue(SINGLE, draws[5] ?? 0))
    expect(jitter[1]?.[0]?.x).toBe(getJitterValue(SINGLE, draws[4] ?? 0))
  })

  it('wraps from slot 0 to slot 19', () => {
    // Arrange / Act
    const jitter = getWandJitter(SINGLE, draws, 1)

    // Assert
    expect(jitter[0]?.[0]?.x).toBe(getJitterValue(SINGLE, draws[0] ?? 0))
    expect(jitter[0]?.[1]?.x).toBe(getJitterValue(SINGLE, draws[19] ?? 0))
  })

  it('jitters x and y alike and leaves z', () => {
    // Arrange / Act
    const entry = getWandJitter(SINGLE, draws, 3)[0]?.[0]

    // Assert
    expect(entry?.x).toBe(entry?.y)
    expect(entry?.z).toBe(0)
  })
})
