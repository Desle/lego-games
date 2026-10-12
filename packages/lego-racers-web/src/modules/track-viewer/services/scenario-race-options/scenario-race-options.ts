import { FpuPrecision } from '@lego-games/lego-racers/simulation-math'
import type { LoadRaceOptions } from '@lego-games/lego-racers/race'
import type { ScenarioRace } from './scenario-race-options.types.ts'

// How a trace scenario's race is loaded: the player in the champion car, the original's single-precision arithmetic.
export const getScenarioRaceOptions = (scenario: ScenarioRace): LoadRaceOptions => ({
  raceFolder: scenario.raceFolder,
  racerCodes: scenario.racerCodes,
  racerCount: scenario.racerCount,
  localPlayerCount: scenario.localPlayerCount,
  isMirrored: scenario.isMirrored,
  fpuPrecision: FpuPrecision.SINGLE,
  isPlayerChampionCar: true,
  // The emulator has no sound device, so the original starts no music stream and spares the racing tune's draw.
  musicTuneCount: 0,
})
