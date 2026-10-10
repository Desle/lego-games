const INTEGER_INDEFINITE_LOW_DWORD = 0
const INT64_LIMIT = 2 ** 63

// MSVCRT _ftol (0x004a84b0): FISTP qword under round-toward-zero, EAX = the low dword.
// NaN and values outside int64 give the integer indefinite 0x8000000000000000, whose low dword is 0.
export const getFloatToInteger = (value: number): number => {
  if (!Number.isFinite(value) || Math.abs(value) >= INT64_LIMIT) return INTEGER_INDEFINITE_LOW_DWORD
  return Number(BigInt.asIntN(32, BigInt(Math.trunc(value))))
}
