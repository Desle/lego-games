export type SoundEffect = {
  readonly channelCount: number
  readonly storedSampleRate: number
  readonly isRateDoubled: boolean
  readonly sampleRate: number
  readonly samples: Int16Array
}

export type SoundBank = {
  readonly directory: string
  readonly declaredSoundCount: number
  readonly soundPaths: readonly string[]
}

export type Music = {
  readonly storedChannelCount: number
  readonly channelCount: number
  readonly sampleRate: number
  readonly samples: Int16Array
}

export type JamTextLine = {
  readonly text: string
  readonly consumedByteCount: number
}
