import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const GAME_FILES_DIRECTORY = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files'
)
const JAM_PATH = resolve(GAME_FILES_DIRECTORY, 'LEGO.JAM')
const EXECUTABLE_PATH = resolve(GAME_FILES_DIRECTORY, 'LEGORacers.exe')

// The trace specs read the player's own files from original-files/ and skip without them.
export const getIsOriginalGamePresent = (): boolean =>
  existsSync(JAM_PATH) && existsSync(EXECUTABLE_PATH)

export const readOriginalJam = (): Uint8Array => new Uint8Array(readFileSync(JAM_PATH))

export const readOriginalExecutable = (): Uint8Array =>
  new Uint8Array(readFileSync(EXECUTABLE_PATH))
