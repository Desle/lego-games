import type { FloatArithmetic, Frame, Matrix3, Vector3 } from '../../../simulation-math/index.ts'

// What 0x0043e740 reads: the display frame (the car's pose), the car model frame's rotation, the two springs, the
// step and the car body's mass (+0xc8), and the seat point (vehicle +0x4c).
export type VehicleLeanRequest = {
  readonly arithmetic: FloatArithmetic
  readonly displayFrame: Frame
  readonly bodyRotation: Matrix3
  // Vehicle +0x398 and +0x39c.
  readonly forwardLean: number
  readonly sideLean: number
  readonly stepMilliseconds: number
  readonly mass: number
  readonly seatPoint: Vector3
}

export type VehicleLean = {
  readonly bodyRotation: Matrix3
  readonly forwardLean: number
  readonly sideLean: number
  readonly driverPosition: Vector3
}
