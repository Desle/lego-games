// What 0x0041f730 reads of the hit material's track-material entry (+0x08 flags, +0x18 signal).
export type ProbeSurface = {
  // Flag 0x20000: the hit counts as a miss.
  readonly isPassThrough: boolean
  // Flag 0x10: the signal the hit starts and stops, else null.
  readonly signalIdentifier: number | null
}
