const view = new DataView(new ArrayBuffer(4))

export const getBitsFromFloat = (value: number): number => {
  view.setFloat32(0, value, true)
  return view.getUint32(0, true)
}

export const getFloatFromBits = (bits: number): number => {
  view.setUint32(0, bits, true)
  return view.getFloat32(0, true)
}

// JavaScript does not expose NaN payloads, so any two NaNs count as the same result.
export const getIsSameFloatBits = (leftBits: number, rightBits: number): boolean =>
  leftBits === rightBits ||
  (Number.isNaN(getFloatFromBits(leftBits)) && Number.isNaN(getFloatFromBits(rightBits)))

export const formatBits = (bits: number): string =>
  `0x${bits.toString(16).padStart(8, '0')} (${String(getFloatFromBits(bits))})`
