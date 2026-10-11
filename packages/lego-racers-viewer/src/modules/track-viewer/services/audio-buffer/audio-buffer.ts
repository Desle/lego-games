const INT16_RANGE = 32768

// Interleaved 16-bit samples → one Float32 array per channel.
export const createAudioBuffer = (
  context: AudioContext,
  samples: Int16Array,
  channelCount: number,
  sampleRate: number
): AudioBuffer => {
  const frameCount = Math.floor(samples.length / channelCount)
  const buffer = context.createBuffer(channelCount, Math.max(frameCount, 1), sampleRate)
  for (let channel = 0; channel < channelCount; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (let frame = 0; frame < frameCount; frame += 1) {
      data[frame] = (samples[frame * channelCount + channel] ?? 0) / INT16_RANGE
    }
  }
  return buffer
}

// A Web Audio context, or null where the platform has none (the specs run in node).
export const createAudioContext = (): AudioContext | null =>
  typeof AudioContext === 'undefined' ? null : new AudioContext()

// What a player does where there is no Web Audio: nothing.
export const SILENT_PLAYER = Object.freeze({
  resume: () => undefined,
  playSound: () => undefined,
  playMusic: () => undefined,
  dispose: () => undefined,
})
