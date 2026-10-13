import { getDriverSeatFailures, getSteeringWheelNotes } from './driver-seat-judgement.ts'
import type { DriverSeatMeasurement } from './hd-coverage.types.ts'

const getSeat = (change: Partial<DriverSeatMeasurement>): DriverSeatMeasurement => ({
  racer: 'JTCM',
  pose: 'seated',
  seatOffset: 20.9,
  originalDriverOffset: 20.9,
  ldrawDriverOffset: 21,
  steeringWheelOffset: 19.5,
  ...change,
})

describe('getDriverSeatFailures', () => {
  it('passes an LDraw driver on the original seat, also when the seat is off the centre line', () => {
    // Arrange
    const seats = [getSeat({}), getSeat({ pose: 'steering', ldrawDriverOffset: 22.7 })]

    // Act
    const failures = getDriverSeatFailures(seats)

    // Assert
    expect(failures).toEqual([])
  })

  it('fails an LDraw driver to the side of the original, and one that could not be measured', () => {
    // Arrange
    const seats = [
      getSeat({ ldrawDriverOffset: 0 }),
      getSeat({ racer: 'design:bvbcha0', ldrawDriverOffset: null }),
    ]

    // Act
    const failures = getDriverSeatFailures(seats)

    // Assert
    expect(failures).toEqual([
      "JTCM seated: the LDraw driver sits 20.9 LDU to the side of the original's",
      expect.stringContaining('design:bvbcha0 seated: the driver could not be measured'),
    ])
  })
})

describe('getSteeringWheelNotes', () => {
  it('notes a model whose steering wheel is not in front of the seat, and not one without a wheel', () => {
    // Arrange
    const seats = [
      getSeat({}),
      getSeat({ racer: 'design:jtchas0', steeringWheelOffset: -0.5 }),
      getSeat({ racer: 'BVBCM', steeringWheelOffset: null }),
    ]

    // Act
    const notes = getSteeringWheelNotes(seats)

    // Assert
    expect(notes).toEqual([
      "design:jtchas0: the model's steering wheel is at -0.5 LDU, the original seats the driver at 20.9; move the wheel in the model file",
    ])
  })
})
