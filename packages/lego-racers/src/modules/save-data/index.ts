export { getLanguageIndex } from './controller/language-index/language-index.ts'
export { parseSaveFile } from './controller/parse-save-file/parse-save-file.ts'
export {
  createDefaultProfile,
  getAreAllGhostsBeaten,
  getBestTime,
  getBestTimeTrackIndex,
  getCircuitUnlockFlags,
  getHasCircuitTrophy,
  getIsCircuitUnlocked,
  getIsPartUnlocked,
  getUnlockedCircuitRunLength,
  markGhostBeaten,
  recordBestTime,
  setTrophyFlags,
  unlockCircuit,
} from './controller/profile-updates/profile-updates.ts'
export { getCircuitRank, recordCircuitRank } from './controller/racer-updates/racer-updates.ts'
export {
  getBlockChecksum,
  readSaveBlocks,
  writeSaveBlocks,
} from './controller/save-blocks/save-blocks.ts'
export { serializeSaveFile } from './controller/serialize-save-file/serialize-save-file.ts'
export {
  createInMemorySaveStorage,
  SAVE_SLOT_COUNT,
  USED_SAVE_SLOT_COUNT,
} from './services/in-memory-save-storage/in-memory-save-storage.ts'
export {
  ALL_GHOSTS_BEATEN_FLAGS,
  ALL_GHOSTS_BEATEN_SCREEN,
  BestTimeKind,
  CHAMPION_GHOST_COUNT,
  GHOSTS_BEATEN_TROPHY_FLAG,
  NO_BEST_TIME,
} from './types/progression-flags/progression-flags.ts'
export type {
  BestTimeKind as BestTimeKindValue,
  BestTimeUpdate,
  GhostBeatenUpdate,
} from './types/progression-flags/progression-flags.types.ts'
export { MAXIMUM_CIRCUIT_RANK } from './types/racer-ranks/racer-ranks.ts'
export type { CircuitRankUpdate } from './types/racer-ranks/racer-ranks.types.ts'
export { SaveFileError, SaveFileFailure } from './types/save-errors/save-errors.ts'
export type { SaveFileFailure as SaveFileFailureValue } from './types/save-errors/save-errors.types.ts'
export {
  BLOCK_BYTE_COUNT,
  BLOCK_DATA_BYTE_COUNT,
  HEADER_DATA_BYTE_COUNT,
  SAVE_FILE_OPEN_SIZE,
  RACER_DATA_OFFSET,
  RACER_RECORD_DATA_BYTE_COUNT,
} from './types/save-layout/save-layout.ts'
export type {
  BestTime,
  InputConfiguration,
  SaveFile,
  SaveProfile,
  SaveRacer,
  SaveStorage,
} from './types/save-data.types.ts'
