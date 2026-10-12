import type { WavAudio } from './wav-encoder.types.ts'

const HEADER_LENGTH = 44
const BITS_PER_SAMPLE = 16
const BYTES_PER_SAMPLE = 2
const FORMAT_CHUNK_LENGTH = 16
const FORMAT_PCM = 1

// 16-bit PCM in a RIFF/WAVE container.
export const encodeWav = (audio: WavAudio): Uint8Array => {
  const data = Buffer.from(audio.samples.buffer, audio.samples.byteOffset, audio.samples.byteLength)
  const blockAlign = audio.channelCount * BYTES_PER_SAMPLE
  const header = Buffer.alloc(HEADER_LENGTH)
  header.write('RIFF', 0, 'latin1')
  header.writeUInt32LE(HEADER_LENGTH - 8 + data.length, 4)
  header.write('WAVEfmt ', 8, 'latin1')
  header.writeUInt32LE(FORMAT_CHUNK_LENGTH, 16)
  header.writeUInt16LE(FORMAT_PCM, 20)
  header.writeUInt16LE(audio.channelCount, 22)
  header.writeUInt32LE(audio.sampleRate, 24)
  header.writeUInt32LE(audio.sampleRate * blockAlign, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(BITS_PER_SAMPLE, 34)
  header.write('data', 36, 'latin1')
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}
