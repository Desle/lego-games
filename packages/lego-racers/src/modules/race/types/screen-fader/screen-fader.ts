import type {
  ScreenFade,
  ScreenFadeColour,
  ScreenFader,
  ScreenFadeRequest,
} from './screen-fader.types.ts'

// Race_LoadTrackContent 0x00433480 gives the fader two entries (0x00494e10).
const SCREEN_FADE_COUNT = 2
// 0x004905e0 scales the clock's fraction by this float (0x004b09c0) into the colour's alpha byte.
const ALPHA_SCALE = 255

// 0x00490530: the reset of an entry.
const IDLE_SCREEN_FADE: ScreenFade = Object.freeze({
  isActive: false,
  isFadingOut: false,
  isEnding: false,
  red: 0,
  green: 0,
  blue: 0,
  totalMilliseconds: 0,
  remainingMilliseconds: 0,
  playerIndex: null,
})

export const createScreenFader = (): ScreenFader =>
  Object.freeze(Array.from({ length: SCREEN_FADE_COUNT }, () => IDLE_SCREEN_FADE))

// 0x00494f30: whether any entry is in use.
export const getIsScreenFaderActive = (fader: ScreenFader): boolean =>
  fader.some((fade) => fade.isActive)

// 0x00494eb0 and 0x00490550: the first free entry takes the request; none free leaves the fader as it is.
export const startScreenFade = (
  fader: ScreenFader,
  request: ScreenFadeRequest,
  colour: ScreenFadeColour
): ScreenFader => {
  const freeIndex = fader.findIndex((fade) => !fade.isActive)
  if (freeIndex < 0) return fader
  return Object.freeze(
    fader.map((fade, index) =>
      index === freeIndex
        ? Object.freeze({
            isActive: true,
            isFadingOut: request.isFadingOut,
            isEnding: false,
            red: colour.red,
            green: colour.green,
            blue: colour.blue,
            totalMilliseconds: request.milliseconds,
            remainingMilliseconds: request.milliseconds,
            playerIndex: request.playerIndex,
          })
        : fade
    )
  )
}

// 0x00490590: an entry whose clock has run out lives one more update (its last draw) and then resets.
const getFadeAfterUpdate = (fade: ScreenFade, stepMilliseconds: number): ScreenFade => {
  if (!fade.isActive) return fade
  if (fade.remainingMilliseconds === 0) {
    return fade.isEnding ? IDLE_SCREEN_FADE : Object.freeze({ ...fade, isEnding: true })
  }
  return Object.freeze({
    ...fade,
    remainingMilliseconds:
      fade.remainingMilliseconds < stepMilliseconds
        ? 0
        : fade.remainingMilliseconds - stepMilliseconds,
  })
}

// 0x00494f60, called by Race_Update with the frame's time step.
export const updateScreenFader = (fader: ScreenFader, stepMilliseconds: number): ScreenFader =>
  Object.freeze(fader.map((fade) => getFadeAfterUpdate(fade, stepMilliseconds)))

// 0x004905e0: the alpha byte is the truncated clock fraction times 255, from the fraction left when the colour fades
// away and from the fraction gone when it fades in.
export const getScreenFadeAlpha = (fade: ScreenFade): number => {
  if (fade.totalMilliseconds === 0) return 0
  const fractionLeft = fade.remainingMilliseconds / fade.totalMilliseconds
  const fraction = fade.isFadingOut ? fractionLeft : 1 - fractionLeft
  return Math.trunc(fraction * ALPHA_SCALE)
}
