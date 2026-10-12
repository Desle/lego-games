// Which phase of a warp a racer is in: starting (the portal, state 2) or carried (the tunnel, state 3).
export type WarpStates = {
  readonly isStarting: boolean
  readonly isCarrying: boolean
}
