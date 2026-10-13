import {
  CHAMPION_GHOST_COUNT,
  GHOSTS_BEATEN_TROPHY_FLAG,
  markGhostBeaten,
  parseSaveFile,
  serializeSaveFile,
  setTrophyFlags,
  unlockCircuit,
} from '@lego-games/lego-racers/save-data'
import type { SaveFile, SaveStorage } from '@lego-games/lego-racers/save-data'

// Circuits 0..6: getUnlockedCircuitRunLength (FUN_00443760) counts up to six after the first.
const CIRCUIT_COUNT = 7
// The slot the game plays on (race-controller's SAVE_SLOT).
const PLAYED_SAVE_SLOT = 0

const getCircuitIndices = (): readonly number[] =>
  Array.from({ length: CIRCUIT_COUNT }, (_, index) => index)

// Every circuit unlocked and won, and every champion ghost beaten: the state the original's own updates reach.
export const getSaveWithEverythingUnlocked = (save: SaveFile): SaveFile => {
  const unlocked = getCircuitIndices().reduce(unlockCircuit, save.profile)
  const trophyFlags = getCircuitIndices().reduce(
    (flags, index) => flags | (1 << index),
    GHOSTS_BEATEN_TROPHY_FLAG
  )
  const ghostsBeaten = Array.from({ length: CHAMPION_GHOST_COUNT }, (_, index) => index).reduce(
    (profile, index) => markGhostBeaten(profile, index).profile,
    setTrophyFlags(unlocked, trophyFlags)
  )
  return Object.freeze({ ...save, profile: ghostsBeaten })
}

// Development only: rewrites the played save slot with everything unlocked; false when the browser holds no save yet.
export const unlockEverythingInStorage = async (storage: SaveStorage): Promise<boolean> => {
  const bytes = await storage.readSlot(PLAYED_SAVE_SLOT)
  if (bytes === null) return false
  const save = getSaveWithEverythingUnlocked(parseSaveFile(bytes))
  await storage.writeSlot(PLAYED_SAVE_SLOT, serializeSaveFile(save))
  return true
}
