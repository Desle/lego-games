import { decodeAdpcmMonoToStereo, decodeAdpcmStereo } from '../../types/adpcm/adpcm.ts'
import {
  ALP_CHANNEL_COUNT_OFFSET,
  getAlpDataOffset,
  getIsAlpAdpcm,
} from '../../types/alp-header/alp-header.ts'
import { MusicReadError } from '../../types/audio-errors/audio-errors.ts'
import type { Music } from '../../types/audio.types.ts'

const MUSIC_HEADER_READ_LENGTH = 0x10
// The streaming buffer format is fixed by the constructor at 0x0041a180.
const MUSIC_CHANNEL_COUNT = 2
const MUSIC_SAMPLE_RATE = 22050

// 0x00419d60 opens the stream and 0x004197a0 decodes it into the DirectSound buffer chunk by chunk.
export const decodeMusic = (bytes: Uint8Array): Music => {
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const isAlpAdpcm = bytes.byteLength >= MUSIC_HEADER_READ_LENGTH && getIsAlpAdpcm(header)
  const storedChannelCount = isAlpAdpcm ? (bytes[ALP_CHANNEL_COUNT_OFFSET] ?? 0) : 1
  const dataOffset = isAlpAdpcm ? getAlpDataOffset(header) : 0
  if (dataOffset < 0 || dataOffset > bytes.byteLength) {
    throw new MusicReadError(`data offset ${String(dataOffset)} is outside the file`)
  }

  const adpcm = bytes.subarray(dataOffset)
  return Object.freeze({
    storedChannelCount,
    channelCount: MUSIC_CHANNEL_COUNT,
    sampleRate: MUSIC_SAMPLE_RATE,
    samples:
      storedChannelCount === MUSIC_CHANNEL_COUNT
        ? decodeAdpcmStereo(adpcm)
        : decodeAdpcmMonoToStereo(adpcm),
  })
}
