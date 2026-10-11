// A sound the race asks its sound player for (RaceSounds_PlayAt 0x00443b80, RaceSounds_Play 0x00443b50): the id.
export type SoundCall = {
  readonly kind: 'sound'
  readonly soundId: number
  // The address that asks for it, when known (the original's trace records the caller).
  readonly address: string | null
}

// A tune the race starts from its music list (the stream's play slot, after 0x0041a8a0 chose the entry).
export type MusicCall = {
  readonly kind: 'music'
  readonly listIndex: number
  readonly isLooping: boolean
}

export type AudioCall = SoundCall | MusicCall

// The calls of one frame; frame -1 is the load, before the first frame.
export type AudioFrameCalls = {
  readonly frame: number
  readonly calls: readonly AudioCall[]
}

export type SoundSummary = {
  readonly soundId: number
  readonly originalCount: number
  readonly portCount: number
  readonly firstOriginalFrame: number | null
  readonly firstPortFrame: number | null
  // The call sites in the original that play it.
  readonly originalAddresses: readonly string[]
  // Frames where both play it but a different number of times, up to ten.
  readonly differingFrames: readonly number[]
}

export type MusicDifference = {
  readonly frame: number
  readonly original: MusicCall | null
  readonly port: MusicCall | null
}

export type AudioComparison = {
  readonly sounds: readonly SoundSummary[]
  readonly musicDifferences: readonly MusicDifference[]
}
