import type { MusicCue } from '../../types/race-audio.types.ts'

// Float at 0x004b07ec, stored in the race at +0x3324 and passed to every music object (slot +0x18).
export const RACE_MUSIC_VOLUME = Math.fround(1.2)

// The list of Royal Knights Raceway (`LEGOMSC`): start, royal, lose, win, knight, moat, armor.
const INTRODUCTION_LIST_INDEX = 0
const RACING_DEFAULT_LIST_INDEX = 1
const LOSS_LIST_INDEX = 2
const WIN_LIST_INDEX = 3
// With more than four entries and no points record, the race picks among these (0x00434b00).
const RACING_LIST_INDICES: readonly number[] = Object.freeze([RACING_DEFAULT_LIST_INDEX, 4, 5, 6])
const MINIMUM_LIST_COUNT_FOR_CHOICE = 5
const CHOICE_SKIPPED_ENTRIES = 3

// 0x00434930, called from Race_LoadTrackContent: entry 0 plays once while the race introduces itself.
export const getIntroductionMusic = (): MusicCue =>
  Object.freeze({ listIndex: INTRODUCTION_LIST_INDEX, isLooping: false, address: '0x00434930' })

// 0x00434b00, when the countdown ends: the introduction track stops and entry 1 plays looped, unless the list
// has more than four entries (and the race has no points record), when one random table draw `r` picks
// `r % (count - 3)`: 1 → entry 4, 2 → entry 5, 3 → entry 6, anything else → entry 1. The draw advances the
// shared random table position, so the caller gives it the value the original would draw.
export const getRacingMusic = (listCount: number, drawRandomValue: () => number): MusicCue => {
  const choice =
    listCount >= MINIMUM_LIST_COUNT_FOR_CHOICE
      ? drawRandomValue() % (listCount - CHOICE_SKIPPED_ENTRIES)
      : 0
  return Object.freeze({
    listIndex: RACING_LIST_INDICES[choice] ?? RACING_DEFAULT_LIST_INDEX,
    isLooping: true,
    address: '0x00434b00',
  })
}

// 0x00434c80, when a human racer finishes: entry 3 plays once for a first place (racer +0xd00 == 1), else entry 2.
export const getFinishMusic = (racePosition: number): MusicCue =>
  Object.freeze({
    listIndex: racePosition === 1 ? WIN_LIST_INDEX : LOSS_LIST_INDEX,
    isLooping: false,
    address: '0x00434c80',
  })
