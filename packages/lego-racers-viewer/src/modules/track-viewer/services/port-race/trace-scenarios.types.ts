export type TraceScenarioRequest = {
  readonly name: string
  readonly raceFolder: string
  readonly isMirrored?: boolean
  // The steering sweep of the golden trace (about 475 frames) instead of idling through the countdown.
  readonly isSteering?: boolean
  readonly recordFrames?: readonly number[]
  readonly isRenderRecorded?: boolean
  // A warp: the player is handed a level 3 turbo at `grantFrame`, accelerates from 175 and presses use at `useFrame`.
  readonly warp?: {
    readonly grantFrame: number
    readonly useFrame: number
    readonly frameCount: number
  }
}

// A scenario of the audio trace and the sound ids the port still lacks in it.
export type AudioTraceCase = TraceScenarioRequest & {
  readonly gapSoundIds: readonly number[]
}

// A scripted visit to the menus: the keys tapped one after the other once the main menu shows.
export type FrontEndAudioCase = {
  readonly name: string
  readonly scanCodes: readonly number[]
}
