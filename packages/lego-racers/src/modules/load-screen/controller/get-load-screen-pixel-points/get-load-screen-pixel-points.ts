import type { ScreenPoint } from '../../types/load-screen.types.ts'

const INTEGER_INDEFINITE = -0x80000000

// MSVCRT _ftol truncates toward zero; out-of-range values give the integer indefinite.
const truncateToInteger = (value: number): number => {
  const truncated = Math.trunc(value)
  return truncated >= -0x80000000 && truncated <= 0x7fffffff ? truncated : INTEGER_INDEFINITE
}

// LEGORacers.exe 0x0042f62b..0x0042f65e: x times the surface width and y times its height (as floats), truncated.
export const getLoadScreenPixelPoints = (
  points: readonly ScreenPoint[],
  width: number,
  height: number
): readonly ScreenPoint[] => {
  const widthAsFloat = Math.fround(width)
  const heightAsFloat = Math.fround(height)
  return Object.freeze(
    points.map(([x, y]) =>
      Object.freeze([
        truncateToInteger(x * widthAsFloat),
        truncateToInteger(y * heightAsFloat),
      ] as const)
    )
  )
}
