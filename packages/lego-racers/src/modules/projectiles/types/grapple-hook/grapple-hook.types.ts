import type { Vector3 } from '../../../simulation-math/index.ts'
import type {
  BallisticFlight,
  BallisticFlightState,
} from '../ballistic-flight/ballistic-flight.types.ts'

// The grapple's body (class 0x00444250, vtable 0x004b0ca8): a ballistic flight with a rope.
export type GrappleHook = {
  // The ballistic part (+0x00..+0xa4); its frame position is the hook's.
  readonly flight: BallisticFlight
  // +0x228..+0x230: where the retracting hook is.
  readonly hookTarget: Vector3
  // +0x234 bit 1 (0x2): the hook is flying back to its owner.
  readonly isRetracting: boolean
  // +0x234 bit 0 (0x1): the hook has reached the racer it latched on.
  readonly isHookArrived: boolean
  // +0x224: grows while latched; the rope is tested against the track once it reaches 1.
  readonly tension: number
  // The owner's frame position the rope was last laid from (0x00444540 and its siblings run in the hook's update).
  readonly ropeOwnerPosition: Vector3
}

export type GrappleAdvance = {
  readonly hook: GrappleHook
  readonly result: BallisticFlightState
}

// 0x00449a90: the moved point and whether it is there.
export type PointMove = {
  readonly position: Vector3
  readonly isArrived: boolean
}
