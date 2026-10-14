import {
  getRaceStateWithFinishes,
  getRaceStateWithGrants,
  getRaceWithHazardsAtCamera,
} from '@lego-games/lego-racers/race'
import type { RacerFinish } from '@lego-games/lego-racers/race'
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
import { getEffectViews, getRacerPoses } from '@lego-games/lego-racers/race-presentation'
import type { RacePresentation } from '@lego-games/lego-racers/race-presentation'
import { getHudContext } from '../hud-resources/hud-resources.ts'
import type { RaceAssets } from '../race-assets/race-assets.types.ts'
import type { RaceStage, RaceStageSize } from '../race-viewport/race-viewport.types.ts'
import type { PortRaceFrame } from '../port-race/port-race.types.ts'
import type { ControlledFrame, ScriptedPowerUpGrant } from './race-frames.types.ts'

// Steps the port's race with scripted frame times and controls, the way the viewer does, and hands every frame (the
// state after the step and the presentation) to `onFrame` as it is made. Returns the introduction music of the load.
export const runRaceFrames = (
  assets: RaceAssets,
  stageSize: RaceStageSize,
  frames: readonly ControlledFrame[],
  onFrame: (portFrame: PortRaceFrame) => void,
  powerUpGrants: readonly ScriptedPowerUpGrant[] = [],
  racerFinishes: readonly RacerFinish[] = []
) => {
  const hudContext = getHudContext(assets, stageSize)
  let raceState: RaceState = createRace(assets.definition)
  const started = createRacePresentation(raceState, assets.musicNames.length)
  let presentation: RacePresentation = started.presentation
  frames.forEach(({ milliseconds, controls }, frame) => {
    const step = stepRace(
      getRaceStateWithFinishes(
        getRaceStateWithGrants(
          raceState,
          powerUpGrants.filter((grant) => grant.frame === frame)
        ),
        racerFinishes.filter((finish) => finish.frame === frame)
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
    raceState = getRaceWithHazardsAtCamera(raceState, presentationFrame.cameraView)
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

// Poses a stage for a frame of `runRaceFrames` as the race controller does: the racers, camera and effects, then the hazards and the
// particles of both emitter pools.
export const showPortRaceFrame = (
  stage: Pick<RaceStage, 'update' | 'showHazards'>,
  { raceState, presentation, ghostCars }: PortRaceFrame
) => {
  stage.update(
    getRacerPoses(raceState),
    presentation.cameraView,
    getEffectViews(raceState),
    presentation.warpView,
    ghostCars,
    presentation.screenFades,
    presentation.fieldOfViewDegrees
  )
  stage.showHazards(raceState.trackLogic, [
    raceState.racerSet.emitters.common,
    raceState.racerSet.emitters.track,
  ])
}
