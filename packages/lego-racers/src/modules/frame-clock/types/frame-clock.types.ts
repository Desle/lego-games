// The application's frame clock (LEGORacers.exe 0x00416ef0): the time of the last frame, in whole milliseconds.
export type FrameClock = {
  // Application +0x820; null before the first frame.
  readonly lastMilliseconds: number | null
}

export type FrameClockAdvance = {
  readonly clock: FrameClock
  // Application +0x824 (the frame delta); null while the original would still be sleeping.
  readonly frameMilliseconds: number | null
}
