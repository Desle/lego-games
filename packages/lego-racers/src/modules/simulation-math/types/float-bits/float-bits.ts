// A float32 constant from its bit pattern, as the disassembly shows it (e.g. 0x3d23d70a at 0x004b0cfc).
export const getFloatFromBits = (bits: number): number => {
  const view = new DataView(new ArrayBuffer(4))
  view.setUint32(0, bits >>> 0)
  return view.getFloat32(0)
}

// _ftol (0x004a84b0, msvcrt): truncates toward zero to a 32-bit integer.
export const getTruncatedInteger = (value: number): number => Math.trunc(value) | 0

// 0x7f7fffff, the largest float32; the race code starts its "deepest so far" searches at its negative.
export const FLOAT32_MAXIMUM = getFloatFromBits(0x7f7fffff)
