export type ScreenPoint = readonly [number, number]

export type LoadScreen = {
  readonly imageName: string | null
  // As read from the file; 0x0042f62d multiplies them by the screen size and truncates.
  readonly points: readonly ScreenPoint[]
  readonly stringIndex: number
  readonly readByteCount: number
}
