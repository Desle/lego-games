// Flag 0x8 (set by slot 12, 0x00448660) switches RigidBody_Step to the two-point code: 0x00448840,
// 0x004464a0, 0x004465c0 and the flag-0x8 branches of 0x00445500 and 0x004452b0. None of it is
// ported yet, so a body with the flag stops with this error instead of running the wrong code.
export class TwoPointModeNotPortedError extends Error {
  readonly address: number

  constructor(address: number) {
    super(
      `Two-point mode (car rigid body flag 0x8) is not ported: 0x${address.toString(16).padStart(8, '0')}`
    )
    this.name = 'TwoPointModeNotPortedError'
    this.address = address
  }
}
