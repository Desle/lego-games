// One `0x27 { ... }` block of 0x00464aa0, as passed to 0x00464750.
export type Timer = {
  readonly firstValue: number
  // Flag 2 of +0x1c.
  readonly isFirstValueMarked: boolean
  readonly secondValue: number
  // Flag 4: 0x00464750 replaces the second value with a random-table draw.
  readonly isSecondValueRandomised: boolean
  readonly thirdValue: number
  readonly identifier: number
}

export type TimerList = {
  readonly timers: readonly Timer[]
  readonly readByteCount: number
}

export type MarkableValue = {
  readonly value: number
  readonly isMarked: boolean
}
