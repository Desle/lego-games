import type { MusicCue } from '../../types/race-audio.types.ts'

// Float at 0x004b07ec, stored in the race at +0x3324 and passed to every music object (slot +0x18).
export const RACE_MUSIC_VOLUME = Math.fround(1.2)

// The list of Royal Knights Raceway (`LEGOMSC`): start, royal, lose, win, knight, moat, armor.
const INTRODUCTION_LIST_INDEX = 0
const LOSS_LIST_INDEX = 2
const WIN_LIST_INDEX = 3

// 0x00434930, called from Race_LoadTrackContent: entry 0 plays once while the race introduces itself.
export const getIntroductionMusic = (): MusicCue =>
  Object.freeze({ listIndex: INTRODUCTION_LIST_INDEX, isLooping: false, address: '0x00434930' })

// The tune the race's music stream switched to (the race's `race.tune_changed` event): 0x00434b00 starts the racing
// tune looped when the countdown ends (entry 1, or entry 4, 5 or 6 by the one random draw the race made), and
// 0x00434c80 plays entry 3 once for a first place and entry 2 once for any other when a human finishes.
export const getTuneMusic = (tuneIndex: number): MusicCue =>
  Object.freeze({
    listIndex: tuneIndex,
    isLooping: tuneIndex !== WIN_LIST_INDEX && tuneIndex !== LOSS_LIST_INDEX,
    address: tuneIndex === WIN_LIST_INDEX || tuneIndex === LOSS_LIST_INDEX ? '0x00434c80' : '0x00434b00',
  })
