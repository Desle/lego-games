// One entry of the race's screen fader (race +0x27fc, 0x18 bytes, constructor 0x00490500): a rectangle of one colour
// laid over a camera's view whose opacity runs with its clock (draw 0x004905e0, update 0x00490590).
export type ScreenFade = {
  // +0x14 bit 0: the entry is in use.
  readonly isActive: boolean
  // +0x14 bit 1: the colour fades away (opaque to clear) instead of in (clear to opaque).
  readonly isFadingOut: boolean
  // +0x14 bit 2: the clock has run out and the entry resets at the next update.
  readonly isEnding: boolean
  // +0x8, +0x9, +0xa.
  readonly red: number
  readonly green: number
  readonly blue: number
  // +0x10 and +0xc: the length and the milliseconds left.
  readonly totalMilliseconds: number
  readonly remainingMilliseconds: number
  // +0x4: the local player whose view it covers (the camera's viewport); null covers the whole surface.
  readonly playerIndex: number | null
}

export type ScreenFader = readonly ScreenFade[]

export type ScreenFadeRequest = {
  readonly milliseconds: number
  readonly isFadingOut: boolean
  readonly playerIndex: number | null
}

export type ScreenFadeColour = Pick<ScreenFade, 'red' | 'green' | 'blue'>
