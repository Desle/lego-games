export type TraceScenarioRequest = {
  readonly name: string
  readonly raceFolder: string
  readonly isMirrored?: boolean
  // 0 is the demonstration: no human, the computer drives racer 0 (race +0x3350).
  readonly localPlayerCount?: number
  // Idle frames to run (default 330: the introduction, the countdown and the first seconds of racing).
  readonly frameCount?: number
  // The circuit key of the settings (default `c1`); the second passes belong to `c3` to `c5`.
  readonly circuitName?: string
  // The drivers (default: those of the race folder's first catalog entry).
  readonly racerCodes?: readonly string[]
  // Game mode 2: the race has the champion's ghost car.
  readonly isTimeTrial?: boolean
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
