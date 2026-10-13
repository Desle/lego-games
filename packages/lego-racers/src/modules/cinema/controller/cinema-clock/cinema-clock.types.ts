// The playback clock of a cinema record (0xb8 bytes): +0x48 the frame on show, +0x50 the frame-milliseconds summed so far
// (rate times milliseconds), flag 4 of +0x44 the end reached (bit 0, running, is cleared with it).
export type CinemaClock = {
  readonly frame: number
  readonly frameMilliseconds: number
  readonly isAtEnd: boolean
}

// What the cinema widget's key handler (0x00466ec0) reads: the clock's frame (null without a cinema record, +0x2b0), the
// record's rate (+0x58), the widget's skippable flag (+0x2cc) and the device event (+0x04 its code, +0x0d a repeat).
export type CinemaSkipInput = {
  readonly frame: number | null
  readonly framesPerSecond: number
  readonly isSkippable: boolean
  readonly eventCode: number
  readonly isRepeated: boolean
}
