// The low 16 bits of an integer the loaders store into a `short` field.
export const getSignedShort = (value: number) => (value << 16) >> 16

export const getUnsignedShort = (value: number) => value & 0xffff

export const getUnsignedByte = (value: number) => value & 0xff

// MOVSX r32,byte ptr: the low 8 bits as a signed byte.
export const getSignedByte = (value: number) => (value << 24) >> 24

// float32 0.001 (GolDP.dll 0x10056a4c and 0x100570b8).
const ONE_THOUSANDTH = Math.fround(0.001)
const EXACT_PRODUCT_LIMIT = 2 ** 29

// `(float)value * 0.001f`; below 2^29 the double product is exact, so one rounding matches x87.
export const getThousandthOf = (value: number): number | null =>
  Math.abs(value) < EXACT_PRODUCT_LIMIT ? Math.fround(value * ONE_THOUSANDTH) : null

// GolDP.dll 0x10056c38 holds float32 2^-30; scaling by a power of two is exact.
export const getFixedPointValue = (value: number) => Math.fround(value * 2 ** -30)
