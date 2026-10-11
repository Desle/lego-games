import { getFrameControls } from '@lego-games/lego-racers/golden-trace'
import { getRaceStateWithGrants } from '@lego-games/lego-racers/race'
import type { PowerUpGrant, TraceFrameInput } from '@lego-games/lego-racers/golden-trace'
import {
  createRace,
  IDLE_RACER_CONTROLS,
  NO_RACE_CONTACTS,
  stepRace,
} from '@lego-games/lego-racers/race'
import type { RaceState } from '@lego-games/lego-racers/race'
import {
  createRacePresentation,
  stepRacePresentation,
} from '@lego-games/lego-racers/race-presentation'
import type { RacePresentation } from '@lego-games/lego-racers/race-presentation'
import { getHudContext } from '../hud-resources/hud-resources.ts'
import type { RaceAssets } from '../race-assets/race-assets.types.ts'
import type { RaceStageSize } from '../race-viewport/race-viewport.types.ts'
import type { PortRaceFrame } from './port-race.types.ts'

// The original runs at 640 x 480 (the display mode the game sets).
export const ORIGINAL_STAGE_SIZE: RaceStageSize = Object.freeze({ width: 640, height: 480 })

// Steps the port's race with the trace's frame times and keys, the way the viewer does, and hands every frame (the state
// after the step and the presentation) to `onFrame` as it is made. Returns the introduction music of the load.
export const runPortRace = (
  assets: RaceAssets,
  frames: readonly TraceFrameInput[],
  onFrame: (portFrame: PortRaceFrame) => void,
  powerUpGrants: readonly PowerUpGrant[] = []
) => {
  const hudContext = getHudContext(assets, ORIGINAL_STAGE_SIZE)
  let raceState: RaceState = createRace(assets.definition)
  const started = createRacePresentation(raceState, assets.musicNames.length)
  let presentation: RacePresentation = started.presentation
  frames.forEach((input, frame) => {
    const controls = getFrameControls(input)
    const step = stepRace(
      getRaceStateWithGrants(
        raceState,
        powerUpGrants.filter((grant) => grant.frame === frame)
      ),
      { controls: [controls], contacts: NO_RACE_CONTACTS },
      input.milliseconds
    )
    raceState = step.raceState
    const presentationFrame = stepRacePresentation(
      presentation,
      step,
      { ...IDLE_RACER_CONTROLS, ...controls },
      input.milliseconds,
      hudContext
    )
    presentation = presentationFrame.presentation
    onFrame(
      Object.freeze({
        frame,
        milliseconds: input.milliseconds,
        raceState,
        presentation: presentationFrame,
      })
    )
  })
  return started.music
}
