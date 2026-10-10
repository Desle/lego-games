import type { BallisticLaunchParameters } from '../../types/ballistic-flight/ballistic-flight.types.ts'

// A point along the owner's forward axis.
export type AheadPoint = {
  readonly distance: number
  readonly height: number
  // The product of distance and forward axis is stored before it is added to the position.
  readonly isProductStored: boolean
}

export type OwnerFlightRequest = {
  readonly parameters: BallisticLaunchParameters
  readonly ahead: AheadPoint
  readonly isLeadLimited: boolean
}
