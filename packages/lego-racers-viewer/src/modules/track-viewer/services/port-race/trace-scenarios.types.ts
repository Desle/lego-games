export type TraceScenarioRequest = {
  readonly name: string
  readonly raceFolder: string
  readonly isMirrored?: boolean
  // The steering sweep of the golden trace (about 475 frames) instead of idling through the countdown.
  readonly isSteering?: boolean
  readonly recordFrames?: readonly number[]
  readonly isRenderRecorded?: boolean
}

// A scenario of the audio trace and the sound ids the port still lacks in it.
export type AudioTraceCase = TraceScenarioRequest & {
  readonly gapSoundIds: readonly number[]
}
