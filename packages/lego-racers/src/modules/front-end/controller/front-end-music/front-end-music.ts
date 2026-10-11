import { FrontEndScreen } from '../../types/front-end-screen/front-end-screen.ts'

// MENUDATA\LEGOMSC: theme, builder, 1st, 2nd, 3rd, circuit1 .. circuit6, lose, rracer, gencar, rrcar, vvcar, credits.
export const FrontEndMusic = Object.freeze({
  THEME: 0,
  BUILDER: 1,
})

// 0x00475d30: the award and win-car screens (ids 0x16..0x1c and 0x25) pick an entry of the list by their id.
const AWARD_MUSIC: Readonly<Record<number, number>> = Object.freeze({
  [FrontEndScreen.CIRCUIT_AWARD_ONE]: 2,
  [FrontEndScreen.CIRCUIT_AWARD_TWO]: 3,
  [FrontEndScreen.CIRCUIT_AWARD_THREE]: 4,
  [FrontEndScreen.CIRCUIT_AWARD_FOUR]: 0xb,
  [FrontEndScreen.WIN_CAR]: 0xd,
  [FrontEndScreen.WIN_ROCKET_RACER_CAR]: 0xe,
  [FrontEndScreen.WIN_VV_CAR]: 0xf,
  [FrontEndScreen.CIRCUIT_SEVEN_INTRODUCTION]: 0xc,
})

// 0x00479b10: the circuit introductions (ids 0x1f..0x24) play the circuit tunes 5 to 10.
const FIRST_CIRCUIT_INTRODUCTION_MUSIC = 5
const LAST_CIRCUIT_INTRODUCTION = 0x24

// 0x00488410: the splash, credits and introduction screens (the class of 0x00488380).
const INTRODUCTION_MUSIC: Readonly<Record<number, number>> = Object.freeze({
  [FrontEndScreen.SPLASH]: 0x12,
  [FrontEndScreen.CREDITS]: 0x11,
  [FrontEndScreen.LEGO_INTRODUCTION]: 0x14,
})

// FrontEnd_SetMusic 0x00480470 (the music list entry, played looped) is called when a screen opens. The award screens,
// the circuit introductions and the introduction screens choose by their id (decompiled). The main menu starts the
// theme and the garage the builder tune, each unless it already plays: the emulator's front end trace shows the theme
// at the main menu, the builder tune on entering the garage, the theme again on the way back, and no change on the
// circuit race, single race, time trial and options screens (hypothesis for the screens not traced).
// Returns the entry to start, or null to let the current one play on.
export const getFrontEndMusicIndex = (
  screenId: number,
  playingIndex: number | null
): number | null => {
  const circuitIntroduction =
    screenId >= FrontEndScreen.CIRCUIT_ONE_INTRODUCTION && screenId <= LAST_CIRCUIT_INTRODUCTION
      ? FIRST_CIRCUIT_INTRODUCTION_MUSIC + screenId - FrontEndScreen.CIRCUIT_ONE_INTRODUCTION
      : undefined
  const wanted =
    AWARD_MUSIC[screenId] ??
    circuitIntroduction ??
    INTRODUCTION_MUSIC[screenId] ??
    (screenId === FrontEndScreen.MAIN_MENU ? FrontEndMusic.THEME : undefined) ??
    (screenId === FrontEndScreen.GARAGE ? FrontEndMusic.BUILDER : undefined)
  return wanted === undefined || wanted === playingIndex ? null : wanted
}
