import {
  decodeAdpcmMono,
  decodeAdpcmMonoDoubled,
  decodeAdpcmStereo,
} from '../../types/adpcm/adpcm.ts'
import {
  ALP_CHANNEL_COUNT_OFFSET,
  ALP_SAMPLE_RATE_OFFSET,
  getAlpDataOffset,
  getIsAlpAdpcm,
} from '../../types/alp-header/alp-header.ts'
import { SoundEffectReadError } from '../../types/audio-errors/audio-errors.ts'
import type { SoundEffect } from '../../types/audio.types.ts'

const SOUND_EFFECT_HEADER_READ_LENGTH = 0x18
const DEFAULT_SAMPLE_RATE = 11025
const MAXIMUM_DOUBLED_SAMPLE_RATE = 11025
const SHORTEST_HEADER_WITH_SAMPLE_RATE = 0x11
const MAXIMUM_CHANNEL_COUNT = 2

const getSamples = (
  adpcm: Uint8Array,
  channelCount: number,
  isRateDoubled: boolean
): Int16Array => {
  // 0x0041b7e0 refuses a zero-byte sound buffer, so nothing is ever decoded.
  if (adpcm.byteLength === 0) return new Int16Array(0)
  if (channelCount === 1) {
    return isRateDoubled ? decodeAdpcmMonoDoubled(adpcm) : decodeAdpcmMono(adpcm)
  }
  const decoded = decodeAdpcmStereo(adpcm)
  if (!isRateDoubled) return decoded
  // The buffer is still sized for doubling, but 0x0041ac20 only fills the first half.
  const samples = new Int16Array(decoded.length * 2)
  samples.set(decoded)
  return samples
}

// 0x0041aa60 loads the file, 0x0041b8d0 sizes the DirectSound buffer and 0x0041ac20 decodes into it.
export const decodeSoundEffect = (bytes: Uint8Array): SoundEffect => {
  const headerBytes = new Uint8Array(SOUND_EFFECT_HEADER_READ_LENGTH)
  headerBytes.set(bytes.subarray(0, SOUND_EFFECT_HEADER_READ_LENGTH))
  const header = new DataView(headerBytes.buffer)
  const isAlpAdpcm = getIsAlpAdpcm(header)
  const channelCount = isAlpAdpcm ? (headerBytes[ALP_CHANNEL_COUNT_OFFSET] ?? 0) : 1
  const dataOffset = isAlpAdpcm ? getAlpDataOffset(header) : 0
  const isSampleRateStored = isAlpAdpcm && dataOffset >= SHORTEST_HEADER_WITH_SAMPLE_RATE
  const storedSampleRate = isSampleRateStored
    ? header.getInt32(ALP_SAMPLE_RATE_OFFSET, true)
    : DEFAULT_SAMPLE_RATE
  const isRateDoubled = isSampleRateStored
    ? storedSampleRate <= MAXIMUM_DOUBLED_SAMPLE_RATE
    : !isAlpAdpcm || channelCount === 1

  if (dataOffset < 0 || dataOffset > bytes.byteLength) {
    throw new SoundEffectReadError(`data offset ${String(dataOffset)} is outside the file`)
  }
  if (channelCount === 0 || channelCount > MAXIMUM_CHANNEL_COUNT) {
    throw new SoundEffectReadError(`unsupported channel count ${String(channelCount)}`)
  }

  const dataLength = (bytes.byteLength - dataOffset) & ~3
  const adpcm = bytes.subarray(dataOffset, dataOffset + dataLength)
  return Object.freeze({
    channelCount,
    storedSampleRate,
    isRateDoubled,
    sampleRate: isRateDoubled ? storedSampleRate << 1 : storedSampleRate,
    samples: getSamples(adpcm, channelCount, isRateDoubled),
  })
}
