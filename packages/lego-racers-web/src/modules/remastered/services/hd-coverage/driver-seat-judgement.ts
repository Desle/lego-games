import type { DriverSeatMeasurement } from './hd-coverage.types.ts'

// The LDraw driver sits where the original's does: its torso's centre at most this far (LDraw units) to the side of the original's.
export const DRIVER_SEAT_TOLERANCE_LDRAW_UNITS = 3
// A steering wheel further than this (LDraw units, half a stud) to the side of the seat is not in front of the driver.
export const STEERING_WHEEL_TOLERANCE_LDRAW_UNITS = 10

const getText = (value: number | null): string => (value === null ? 'none' : String(value))

export const formatDriverSeat = (seat: DriverSeatMeasurement): string =>
  `${seat.racer} ${seat.pose}: seat point ${String(seat.seatOffset)}, original driver ${getText(seat.originalDriverOffset)}, LDraw driver ${getText(seat.ldrawDriverOffset)}, steering wheel ${getText(seat.steeringWheelOffset)} (LDraw units to the car's left)`

// The racers whose LDraw driver does not sit where the original's does, or could not be measured.
export const getDriverSeatFailures = (seats: readonly DriverSeatMeasurement[]): readonly string[] =>
  seats.flatMap((seat) => {
    if (seat.originalDriverOffset === null || seat.ldrawDriverOffset === null) {
      return [
        `${seat.racer} ${seat.pose}: the driver could not be measured (${formatDriverSeat(seat)})`,
      ]
    }
    const distance = Math.abs(seat.ldrawDriverOffset - seat.originalDriverOffset)
    return distance <= DRIVER_SEAT_TOLERANCE_LDRAW_UNITS
      ? []
      : [
          `${seat.racer} ${seat.pose}: the LDraw driver sits ${distance.toFixed(1)} LDU to the side of the original's`,
        ]
  })

// The LDraw cars whose steering wheel is not in front of the driver: the model file, not the layer, puts it elsewhere than the original's
// seat (a model to correct; the folder is the user's, so this is a note, not a failure).
export const getSteeringWheelNotes = (seats: readonly DriverSeatMeasurement[]): readonly string[] =>
  seats.flatMap((seat) =>
    seat.steeringWheelOffset === null ||
    seat.originalDriverOffset === null ||
    Math.abs(seat.steeringWheelOffset - seat.originalDriverOffset) <=
      STEERING_WHEEL_TOLERANCE_LDRAW_UNITS
      ? []
      : [
          `${seat.racer}: the model's steering wheel is at ${String(seat.steeringWheelOffset)} LDU, the original seats the driver at ${String(seat.originalDriverOffset)}; move the wheel in the model file`,
        ]
  )
