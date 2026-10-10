// LEGORacers.exe 0x004be640: sixteen int32 entries, identical to the standard IMA ADPCM index table.
export const ADPCM_INDEX_TABLE: readonly number[] = Object.freeze([
  -1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8,
])

// LEGORacers.exe 0x004be680: 89 int32 entries, identical to the standard IMA ADPCM step table.
export const ADPCM_STEP_TABLE: readonly number[] = Object.freeze([
  7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73,
  80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494,
  544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499,
  2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487,
  12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767,
])

const MAXIMUM_STEP_INDEX = 88
const MAXIMUM_SAMPLE = 0x7fff
const MINIMUM_SAMPLE = -0x8000

// High nibble first; unlike standard IMA the difference has no step/8 term (0x00418100).
const decodeChannel = (
  bytes: Uint8Array,
  firstByte: number,
  byteStride: number,
  byteCount: number
): Int16Array => {
  const samples = new Int16Array(byteCount * 2)
  let predictor = 0
  let stepIndex = 0
  for (let byteIndex = 0; byteIndex < byteCount; byteIndex++) {
    const byte = bytes[firstByte + byteIndex * byteStride] ?? 0
    for (let nibbleIndex = 0; nibbleIndex < 2; nibbleIndex++) {
      const nibble = nibbleIndex === 0 ? byte >> 4 : byte & 0x0f
      const step = ADPCM_STEP_TABLE[stepIndex] ?? 0
      stepIndex = Math.min(
        MAXIMUM_STEP_INDEX,
        Math.max(0, stepIndex + (ADPCM_INDEX_TABLE[nibble] ?? 0))
      )
      const difference = ((nibble & 7) * step) >> 2
      predictor =
        (nibble & 8) === 0
          ? Math.min(MAXIMUM_SAMPLE, predictor + difference)
          : Math.max(MINIMUM_SAMPLE, predictor - difference)
      samples[byteIndex * 2 + nibbleIndex] = predictor
    }
  }
  return samples
}

// 0x00418100: every byte becomes two mono samples.
export const decodeAdpcmMono = (bytes: Uint8Array): Int16Array =>
  decodeChannel(bytes, 0, 1, bytes.byteLength)

// 0x004184c0: each sample is preceded by its average with the previous one (zero at the start).
export const decodeAdpcmMonoDoubled = (bytes: Uint8Array): Int16Array => {
  const decoded = decodeAdpcmMono(bytes)
  const samples = new Int16Array(decoded.length * 2)
  let previous = 0
  for (const [index, sample] of decoded.entries()) {
    samples[index * 2] = (previous + sample) >> 1
    samples[index * 2 + 1] = sample
    previous = sample
  }
  return samples
}

// 0x00418200: the mono decode of 0x00418100 with every sample written to both stereo channels.
export const decodeAdpcmMonoToStereo = (bytes: Uint8Array): Int16Array => {
  const decoded = decodeAdpcmMono(bytes)
  const samples = new Int16Array(decoded.length * 2)
  for (const [index, sample] of decoded.entries()) {
    samples[index * 2] = sample
    samples[index * 2 + 1] = sample
  }
  return samples
}

// 0x00418410 via 0x00418310: bytes alternate left, right; a trailing unpaired byte is dropped.
export const decodeAdpcmStereo = (bytes: Uint8Array): Int16Array => {
  const pairCount = bytes.byteLength >> 1
  const left = decodeChannel(bytes, 0, 2, pairCount)
  const right = decodeChannel(bytes, 1, 2, pairCount)
  const samples = new Int16Array(left.length * 2)
  for (const [index, sample] of left.entries()) {
    samples[index * 2] = sample
    samples[index * 2 + 1] = right[index] ?? 0
  }
  return samples
}
