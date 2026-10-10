export const ALP_SIGNATURE = 0x20504c41
export const ADPC_TAG = 0x43504441
export const ALP_HEADER_SIZE_OFFSET = 4
export const ALP_TAG_OFFSET = 8
export const ALP_CHANNEL_COUNT_OFFSET = 15
export const ALP_SAMPLE_RATE_OFFSET = 16
// The header size field excludes the "ALP " signature and the size field itself.
export const ALP_HEADER_SIZE_BIAS = 8

export const getIsAlpAdpcm = (header: DataView): boolean =>
  header.getUint32(0, true) === ALP_SIGNATURE && header.getUint32(ALP_TAG_OFFSET, true) === ADPC_TAG

export const getAlpDataOffset = (header: DataView): number =>
  (header.getInt32(ALP_HEADER_SIZE_OFFSET, true) + ALP_HEADER_SIZE_BIAS) | 0
