import {
  clearPointsRecord,
  createPointsRecord,
  POINTS_BY_PLACE,
  POINTS_TICKER_RESTART_MILLISECONDS,
  recordPlace,
  tickPointsRecord,
} from './points-record.ts'

describe('points record', () => {
  it('awards 30, 20, 10, 3, 2 and 1 points for the first six places (0x004b0b58)', () => {
    // Arrange
    const record = createPointsRecord()

    // Act
    const placed = POINTS_BY_PLACE.reduce(
      (current, _points, placedCount) => recordPlace(current, 5 - placedCount, placedCount),
      record
    )

    // Assert
    expect(POINTS_BY_PLACE).toEqual([30, 20, 10, 3, 2, 1])
    expect(placed.racePoints).toEqual([1, 2, 3, 10, 20, 30])
    expect(placed.totalPoints).toEqual([1, 2, 3, 10, 20, 30])
  })

  it('adds the race points to the circuit total and replaces them for the race (0x004402c0)', () => {
    // Arrange
    const first = recordPlace(createPointsRecord(), 2, 0)

    // Act
    const second = recordPlace(first, 2, 1)

    // Assert
    expect(second.totalPoints[2]).toBe(50)
    expect(second.racePoints[2]).toBe(20)
  })

  it('restarts the ticker at 400 when the frame is longer than what is left (0x00440330)', () => {
    // Arrange
    const record = Object.freeze({ ...createPointsRecord(), tickerMilliseconds: 100 })

    // Act
    const counted = tickPointsRecord(record, 33)
    const restarted = tickPointsRecord(record, 101)
    const exact = tickPointsRecord(record, 100)

    // Assert
    expect(counted.tickerMilliseconds).toBe(67)
    expect(restarted.tickerMilliseconds).toBe(POINTS_TICKER_RESTART_MILLISECONDS)
    expect(exact.tickerMilliseconds).toBe(0)
  })

  it('clears every total and every race result (0x00440860)', () => {
    // Arrange
    const record = recordPlace(createPointsRecord(), 1, 0)

    // Act
    const cleared = clearPointsRecord(record)

    // Assert
    expect(cleared.totalPoints).toEqual([0, 0, 0, 0, 0, 0])
    expect(cleared.racePoints).toEqual([0, 0, 0, 0, 0, 0])
  })
})
