import { getRaceStateWithGrants } from '@lego-games/lego-racers/race'
import {
  createRace,
  IDLE_RACER_CONTROLS,
  NO_RACE_CONTACTS,
  stepRace,
} from '@lego-games/lego-racers/race'
import type { RaceState } from '@lego-games/lego-racers/race'
import {
  createRacePresentation,
  getGhostCars,
  stepRacePresentation,
} from '@lego-games/lego-racers/race-presentation'
import type { RacePresentation } from '@lego-games/lego-racers/race-presentation'
import { getHudContext } from '../hud-resources/hud-resources.ts'
import type { RaceAssets } from '../race-assets/race-assets.types.ts'
import type { RaceStageSize } from '../race-viewport/race-viewport.types.ts'
import type { PortRaceFrame } from '../port-race/port-race.types.ts'
import type { ControlledFrame, ScriptedPowerUpGrant } from './race-frames.types.ts'

// Steps the port's race with scripted frame times and controls, the way the viewer does, and hands every frame (the
// state after the step and the presentation) to `onFrame` as it is made. Returns the introduction music of the load.
export const runRaceFrames = (
  assets: RaceAssets,
  stageSize: RaceStageSize,
  frames: readonly ControlledFrame[],
  onFrame: (portFrame: PortRaceFrame) => void,
  powerUpGrants: readonly ScriptedPowerUpGrant[] = []
) => {
  const hudContext = getHudContext(assets, stageSize)
  let raceState: RaceState = createRace(assets.definition)
  const started = createRacePresentation(raceState, assets.musicNames.length)
  let presentation: RacePresentation = started.presentation
  frames.forEach(({ milliseconds, controls }, frame) => {
    const step = stepRace(
      getRaceStateWithGrants(
        raceState,
        powerUpGrants.filter((grant) => grant.frame === frame)
      ),
      { controls: [controls], contacts: NO_RACE_CONTACTS },
      milliseconds
    )
    // The draw's update (0x00435a00) runs the ghost playback after the race's update; the rate it stores is the next step's.
    const ghostStep = getGhostCars(step.raceState)
    raceState = ghostStep.raceState
    const presentationFrame = stepRacePresentation(
      presentation,
      step,
      { ...IDLE_RACER_CONTROLS, ...controls },
      milliseconds,
      hudContext
    )
    presentation = presentationFrame.presentation
    onFrame(
      Object.freeze({
        frame,
        milliseconds,
        raceState,
        presentation: presentationFrame,
        ghostCars: ghostStep.cars,
      })
    )
  })
  return started.music
}
