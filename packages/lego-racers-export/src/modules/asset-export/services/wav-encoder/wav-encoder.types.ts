export type WavAudio = {
  readonly channelCount: number
  readonly sampleRate: number
  // Interleaved 16-bit samples.
  readonly samples: Int16Array
}
