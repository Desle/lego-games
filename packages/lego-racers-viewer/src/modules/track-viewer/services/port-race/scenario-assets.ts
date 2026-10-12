import type { PresentationScenario } from '@lego-games/lego-racers/presentation-trace'
import { FpuPrecision } from '@lego-games/lego-racers/simulation-math'
import { loadRaceAssets } from '../race-assets/race-assets.ts'
import type { RaceAssets } from '../race-assets/race-assets.types.ts'
import { readOriginalExecutable } from './original-game-files.ts'

// The port's assets for a trace scenario's race, loaded as the trace's race is: the player in the champion car.
export const loadScenarioAssets = (jam: Uint8Array, scenario: PresentationScenario): RaceAssets =>
  loadRaceAssets(
    jam,
    { executable: readOriginalExecutable(), tunes: new Map() },
    {
      raceFolder: scenario.raceFolder,
      racerCodes: scenario.racerCodes,
      racerCount: scenario.racerCount,
      localPlayerCount: scenario.localPlayerCount,
      isMirrored: scenario.isMirrored,
      fpuPrecision: FpuPrecision.SINGLE,
      isPlayerChampionCar: true,
      // The emulator has no sound device, so the original starts no music stream and spares the racing tune's draw.
      musicTuneCount: 0,
    }
  )
