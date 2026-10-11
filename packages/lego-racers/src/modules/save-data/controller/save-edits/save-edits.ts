import { RACER_NAME_CHARACTER_COUNT } from '../../types/save-layout/save-layout.ts'
import type { SaveFile, SaveProfile, SaveRacer } from '../../types/save-data.types.ts'

// FUN_00443910 and FUN_00443940 open the file with 0x3e00 bytes: room for the header and 23 racers. **Hypothesis** that it
// is the limit of racers a save can hold (the shipped QBUILD.LRS holds 24 but is never saved to).
export const MAXIMUM_SAVED_RACER_COUNT = 23
// The option byte that holds the laps for several players (profile `+0x23`, `FrontEnd_ApplyProfileOptions` 0x0042e1f0).
export const LAP_OPTION_BYTE_INDEX = 6

export const getSaveWithRacer = (
  saveFile: SaveFile,
  racerIndex: number,
  racer: SaveRacer
): SaveFile =>
  Object.freeze({
    ...saveFile,
    racers: Object.freeze(
      saveFile.racers.map((candidate, index) => (index === racerIndex ? racer : candidate))
    ),
  })

// A racer added to the end of the list (the garage's "new racer", `0x00481fe0`); refused beyond the file's capacity.
export const getSaveWithAddedRacer = (saveFile: SaveFile, racer: SaveRacer): SaveFile =>
  saveFile.racers.length >= MAXIMUM_SAVED_RACER_COUNT
    ? saveFile
    : Object.freeze({ ...saveFile, racers: Object.freeze([...saveFile.racers, racer]) })

// The garage's "delete racer": the last racer cannot be deleted.
export const getSaveWithoutRacer = (saveFile: SaveFile, racerIndex: number): SaveFile =>
  saveFile.racers.length <= 1
    ? saveFile
    : Object.freeze({
        ...saveFile,
        racers: Object.freeze(saveFile.racers.filter((_, index) => index !== racerIndex)),
      })

// FrontEnd_ApplyProfileOptions 0x0042e1f0 reads the opponents from `+0x0c` and the laps from the option byte 6; the options
// screen writes them back (0x004833e0).
export const getProfileWithRaceOptions = (
  profile: SaveProfile,
  racerCountOption: number,
  lapCount: number
): SaveProfile =>
  Object.freeze({
    ...profile,
    racerCountOption,
    optionBytes: Object.freeze(
      profile.optionBytes.map((value, index) =>
        index === LAP_OPTION_BYTE_INDEX ? lapCount : value
      )
    ),
  })

// A racer's name is at most 14 characters (`RACER_NAME_CHARACTER_COUNT`).
export const getRacerName = (characters: string): string =>
  characters.slice(0, RACER_NAME_CHARACTER_COUNT)
