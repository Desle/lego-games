import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// The specs read the original game from original-files/ at the repository root and skip without it.
export const ORIGINAL_JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)

export const getIsOriginalJamPresent = (): boolean => existsSync(ORIGINAL_JAM_PATH)

export const readOriginalJam = (): Uint8Array => new Uint8Array(readFileSync(ORIGINAL_JAM_PATH))
