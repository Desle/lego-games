export type TraceScenarioRequest = {
  readonly name: string
  readonly raceFolder: string
  readonly isMirrored?: boolean
  // The steering sweep of the golden trace (about 475 frames) instead of idling through the countdown.
  readonly isSteering?: boolean
  // Full throttle and two power slides (the tire smoke runs and the wheels leave marks).
  readonly isPowerSliding?: boolean
  readonly recordFrames?: readonly number[]
  readonly isRenderRecorded?: boolean
  // Record the triangles the original's decals hold (they are projected whether or not the camera sees them).
  readonly isDecalRecorded?: boolean
  // A power-up: the player is handed a brick of `kind` (1 to 4) at `level` at `grantFrame`, accelerates from 175 and presses use at `useFrame`.
  readonly powerUp?: {
    readonly kind: number
    readonly level: number
    readonly grantFrame: number
    readonly useFrame: number
    readonly frameCount: number
  }
}

// A scenario of the audio trace.
export type AudioTraceCase = TraceScenarioRequest

// A scripted visit to the menus: the keys tapped one after the other once the main menu shows.
export type FrontEndAudioCase = {
  readonly name: string
  readonly scanCodes: readonly number[]
}
