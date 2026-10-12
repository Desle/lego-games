import { getIsScreenFaderActive, startScreenFade } from '../../types/screen-fader/screen-fader.ts'
import type { ScreenFadeColour, ScreenFader } from '../../types/screen-fader/screen-fader.types.ts'
import type { RaceState } from '../../types/race.types.ts'

// The fades the race's own code starts through 0x00494eb0 are all black (colour argument 0) over the first local player's
// view (player argument 0).
const BLACK: ScreenFadeColour = Object.freeze({ red: 0, green: 0, blue: 0 })
const FIRST_PLAYER_INDEX = 0

// Race_LoadTrackContent 0x00433480, call at 0x00433525: after the fader's two entries (0x00494e10) it starts the picture
// fading in from black (`push 1` flag: fading out) over 0x1f4 ms.
const START_FADE_MILLISECONDS = 500 // 0x0043351e

// Race_UpdateState4 0x00434eb0, call at 0x00434ee8: from 9,000 ms of the state, with no fade running and no points record
// (race +0x18 is zero), the picture fades to black over 1,000 ms (flag 0: the colour fades in).
const FINISH_FADE_START_MILLISECONDS = 9000 // 0x00434eb7 (`cmp [race + 0x332c], 0x2328`)
const FINISH_FADE_MILLISECONDS = 1000 // 0x00434ee1

// Race_UpdateState5 0x00435180, call at 0x004351ab: from 4,000 ms of the state, with no fade running, the same fade.
const RESULTS_FADE_START_MILLISECONDS = 4000 // 0x00435184 (`cmp [race + 0x332c], 0xfa0`)
const RESULTS_FADE_MILLISECONDS = 1000 // 0x004351a4

export const getStartScreenFader = (fader: ScreenFader): ScreenFader =>
  startScreenFade(
    fader,
    { milliseconds: START_FADE_MILLISECONDS, isFadingOut: true, playerIndex: FIRST_PLAYER_INDEX },
    BLACK
  )

const getRaceWithFadeToBlack = (raceState: RaceState, milliseconds: number): RaceState =>
  Object.freeze({
    ...raceState,
    screenFader: startScreenFade(
      raceState.screenFader,
      { milliseconds, isFadingOut: false, playerIndex: FIRST_PLAYER_INDEX },
      BLACK
    ),
  })

// The first lines of Race_UpdateState4.
export const getRaceWithFinishFade = (raceState: RaceState): RaceState =>
  raceState.phaseMilliseconds > FINISH_FADE_START_MILLISECONDS &&
  !getIsScreenFaderActive(raceState.screenFader) &&
  raceState.pointsRecord === null
    ? getRaceWithFadeToBlack(raceState, FINISH_FADE_MILLISECONDS)
    : raceState

// The first lines of Race_UpdateState5.
export const getRaceWithResultsFade = (raceState: RaceState): RaceState =>
  raceState.phaseMilliseconds > RESULTS_FADE_START_MILLISECONDS &&
  !getIsScreenFaderActive(raceState.screenFader)
    ? getRaceWithFadeToBlack(raceState, RESULTS_FADE_MILLISECONDS)
    : raceState
