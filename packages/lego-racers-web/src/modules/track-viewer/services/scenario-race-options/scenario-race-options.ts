import { createGhostSession, loadChampionGhost, parseGhost } from '@lego-games/lego-racers/ghost'
import type { GhostSession } from '@lego-games/lego-racers/ghost'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import { FpuPrecision } from '@lego-games/lego-racers/simulation-math'
import type { LoadRaceOptions } from '@lego-games/lego-racers/race'
import type { ScenarioRace } from './scenario-race-options.types.ts'

const GHOST_FILE_NAME = 'GHOST.GHB'

// A time trial's ghost object with the race folder's champion loaded (Ghost_Initialize 0x00422420, Ghost_LoadChampion
// 0x00422de0); null in any other race.
const getScenarioGhost = (scenario: ScenarioRace, jam: Uint8Array): GhostSession | null => {
  if (scenario.isTimeTrial !== true) return null
  const archive = openJamArchive(jam)
  const path = `GAMEDATA\\${scenario.raceFolder}\\${GHOST_FILE_NAME}`
  const champion = archive.getFilePaths().includes(path)
    ? parseGhost(archive.readFile(path), scenario.isMirrored)
    : null
  return loadChampionGhost(createGhostSession(scenario.isMirrored), champion)
}

// How a trace scenario's race is loaded: the player in the champion car, the original's single-precision arithmetic.
export const getScenarioRaceOptions = (
  scenario: ScenarioRace,
  jam: Uint8Array
): LoadRaceOptions => ({
  raceFolder: scenario.raceFolder,
  racerCodes: scenario.racerCodes,
  racerCount: scenario.racerCount,
  localPlayerCount: scenario.localPlayerCount,
  isMirrored: scenario.isMirrored,
  fpuPrecision: FpuPrecision.SINGLE,
  isPlayerChampionCar: true,
  // The emulator has no sound device, so the original starts no music stream and spares the racing tune's draw.
  musicTuneCount: 0,
  ghost: getScenarioGhost(scenario, jam),
})
