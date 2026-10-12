import type { PresentationScenario } from '@lego-games/lego-racers/presentation-trace'
import { loadRaceAssets } from '../race-assets/race-assets.ts'
import type { RaceAssets } from '../race-assets/race-assets.types.ts'
import { getScenarioRaceOptions } from '../scenario-race-options/scenario-race-options.ts'
import { readOriginalExecutable } from './original-game-files.ts'

// The port's assets for a trace scenario's race, loaded as the trace's race is: the player in the champion car.
export const loadScenarioAssets = (jam: Uint8Array, scenario: PresentationScenario): RaceAssets =>
  loadRaceAssets(
    jam,
    { executable: readOriginalExecutable(), tunes: new Map() },
    getScenarioRaceOptions(scenario, jam)
  )
