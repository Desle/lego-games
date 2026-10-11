import { getCircuitRank, recordCircuitRank } from './racer-updates.ts'

const RACER = {
  name: 'ASH',
  colorBytes: [0, 0, 0, 0, 0],
  chassisName: 'dachas0',
  designBytes: [],
  circuitRanks: 0,
}

describe('circuit ranks of a racer', () => {
  it('stores a place per circuit in two bits', () => {
    // Arrange
    const first = recordCircuitRank(RACER, 0, 2).racer

    // Act
    const second = recordCircuitRank(first, 3, 1).racer

    // Assert
    expect(second.circuitRanks).toBe(0b01_00_00_10)
    expect(getCircuitRank(second, 0)).toBe(2)
    expect(getCircuitRank(second, 3)).toBe(1)
    expect(getCircuitRank(second, 1)).toBe(0)
  })

  it('keeps a place that is as good or better', () => {
    // Arrange
    const stored = recordCircuitRank(RACER, 1, 2).racer

    // Act
    const same = recordCircuitRank(stored, 1, 2)
    const worse = recordCircuitRank(stored, 1, 3)
    const better = recordCircuitRank(stored, 1, 1)

    // Assert
    expect([same.isRecorded, worse.isRecorded, better.isRecorded]).toEqual([false, false, true])
    expect(getCircuitRank(better.racer, 1)).toBe(1)
  })

  it('refuses a place beyond third', () => {
    // Arrange / Act
    const update = recordCircuitRank(RACER, 0, 4)

    // Assert
    expect(update.isRecorded).toBe(false)
  })
})
