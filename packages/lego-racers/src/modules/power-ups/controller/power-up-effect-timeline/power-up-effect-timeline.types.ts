export type OwnerEventType =
  | 'power_ups.racer_warp_started'
  | 'power_ups.racer_warp_ended'
  | 'power_ups.racer_shield_lowered'

export type OwnerEvent = {
  readonly type: OwnerEventType
  readonly racer: number
}
