import { getFrameControls } from '@lego-games/lego-racers/golden-trace'
import type { PowerUpGrant, TraceFrameInput } from '@lego-games/lego-racers/golden-trace'
import type { RaceAssets } from '../race-assets/race-assets.types.ts'
import { runRaceFrames } from '../race-frames/race-frames.ts'
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
) =>
  runRaceFrames(
    assets,
    ORIGINAL_STAGE_SIZE,
    frames.map((input) => ({
      milliseconds: input.milliseconds,
      controls: getFrameControls(input),
    })),
    onFrame,
    powerUpGrants
  )
